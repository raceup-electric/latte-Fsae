/* Class for handling file reading/writing, bounding box drawing */
function App() {
	this.fnames = [];
	this.frames = {};
	this.cur_frame;
	this.cur_pointcloud;
	this.move2D = false;
	this.eps = 0.00001;
	this.show_prev_frame;
	this.editing_box_id;
	this.evaluators = [];
	this.controls = {};
	this.lock_frame = false;
	this.use_ground_removed = false;
    this.show_annotations = true;

	this.init = function() {
		$.ajax({
			context: this,
			url: '/loadFrameNames',
			type: 'POST',
			contentType: 'application/json;charset=UTF-8',
			success: function(response) {
				this.drives = parsePythonJSON(response);
				var drive_keys = Object.keys(this.drives);
				drive_keys.sort();
				for (var i = 0; i < drive_keys.length; i++) {
					var drive = drive_keys[i];
					for (var j = 0; j < this.drives[drive].length; j++) {
						var fname = pathJoin([drive, this.drives[drive][j].split('.')[0]]);
						this.fnames.push(fname);
						addFrameRow(fname);
						this.controls[fname] = i;
					}
				}
				this.set_frame(this.fnames[0]);
				focus_frame_row(getFrameRow(this.fnames[0]));
			},
			error: function(error) {
				console.log(error);
			}
		});
	};

	this.get_prev_fname = function(fname) {
		var idx = this.fnames.indexOf(fname);
		if (idx == 0) {
			return ""
		}
		return this.fnames[idx-1];
	}

	this.get_frame = function(fname) {
		if (fname in this.frames) {
			return this.frames[fname];
		} else {
			return false;
		}
	};
	this.updateAnnotationVisibility = function() {
        if (!this.cur_frame || !this.cur_frame.bounding_boxes) return;
        
        var boxes = this.cur_frame.bounding_boxes;
        
        for (var i = 0; i < boxes.length; i++) {
            var box = boxes[i];
            
            for (var key in box) {
                if (box.hasOwnProperty(key)) {
                    var prop = box[key];
                    if (prop && prop instanceof THREE.Object3D) {
                        prop.visible = this.show_annotations;
                    }
                }
            }
            
            if (box.text && box.text.style) {
                box.text.style.display = this.show_annotations ? "block" : "none";
            }
        }
        

        if (this.show_annotations) {
            $('.text-label').show();
            $('.label').show();  
        } else {
            $('.text-label').hide();
            $('.label').hide();
        }
    };

    this.toggleAnnotations = function() {
        this.show_annotations = !this.show_annotations;

        var btn = document.getElementById("toggle-annotations-btn");
        if(btn) {
            btn.innerText = this.show_annotations ? "Hide labels" : "Show labels";
            btn.style.backgroundColor = this.show_annotations ? "#2196F3" : "#FF9800"; 
        }
        
        this.updateAnnotationVisibility();
    };

    this.toggleGroundRemoved = function() {
        this.use_ground_removed = !this.use_ground_removed;
        var btn = document.getElementById("toggle-ground-btn");
        if(btn) {
            btn.innerText = this.use_ground_removed ? "Show ground" : "Remove ground";
            btn.style.backgroundColor = this.use_ground_removed ? "#f44336" : "#4CAF50";
        }
        
        if (!this.cur_frame) return;

        $.ajax({
            context: this,
            url: '/getJustPointCloud',
            data: JSON.stringify({fname: this.cur_frame.fname, ground_removed: this.use_ground_removed}),
            type: 'POST',
            contentType: 'application/json;charset=UTF-8',
            success: function(response) {
                var data = response.split(',').map(x => parseFloat(x));
                this.cur_frame.data = data;
                this.cur_frame.is_ground_removed = this.use_ground_removed; // Salva stato nella cache
                this.cur_frame.ys = [];
		        var k = 0;
		        var stride = typeof DATA_STRIDE !== 'undefined' ? DATA_STRIDE : 4; 
		        for ( var i = 0, l = data.length / stride; i < l; i ++ ) {
		        	this.cur_frame.ys.push(data[ stride * k + 2 ]);
		        	k++;
		        }
                
                // Rigenera i punti 3D e li sostituisce a schermo
                generatePointCloud();
            },
            error: function(error) {
                console.log("Errore nel download della point cloud: ", error);
            }
        });
    };
    this.load_frame_clusters = function(frame) {
        if (!frame || frame.clusters_loaded) return

        $.ajax({
            context: this,
            url: '/getFrameClustersData', // The Python route we built earlier
            type: 'POST',
            contentType: 'application/json;charset=UTF-8',
            data: JSON.stringify({ fname: frame.fname }),
            success: function(cluster_metadata) {
                // Cache the lightweight math data
                frame.cluster_metadata = cluster_metadata;
                frame.clusters_loaded = true;
                
                console.log("NUM CLUSTERS in this frame: " + cluster_metadata.length);
            },
            error: function(err) {
                console.log("Error caching frame clusters: ", err);
            }
        });
    };

    this.set_frame = function(fname) {
		var frame = this.get_frame(fname);
		
		if (this.cur_frame == frame || this.lock_frame) {
		    return;
		} 
		if (this.cur_frame) {
		    this.write_frame_out();
		    this.cur_frame.scene_remove_frame_children();   
		    this.show_prev_frame = false;   
		}
		
		if (frame && frame.is_ground_removed === this.use_ground_removed) {
		    show(frame);
		    this.updateAnnotationVisibility();
		} else {
		    $.ajax({
		        context: this,
		        url: '/getFramePointCloud',
		        data: JSON.stringify({fname: fname, ground_removed: this.use_ground_removed}),
		        type: 'POST',
		        contentType: 'application/json;charset=UTF-8',
		        success: function(response) {
		            var data, res, annotation, bounding_boxes_json, bounding_boxes, box;
		            res = response.split('?');
		            
		            data = res[0].split(',')
		                         .filter(x => x.trim() !== '') 
		                         .map(x => parseFloat(x));
		            
		            if (frame) {
		                frame.data = data;
		                frame.is_ground_removed = this.use_ground_removed;
		                
		                frame.ys = [];
		                var k = 0;
		                var stride = typeof DATA_STRIDE !== 'undefined' ? DATA_STRIDE : 4; 
		                for ( var i = 0, l = frame.data.length / stride; i < l; i ++ ) {
		                    frame.ys.push(frame.data[ stride * k + 2 ]);
		                    k++;
		                }
		                
		            } else {
		                // Creating a brand new frame
		                frame = new Frame(fname, data);
		                frame.is_ground_removed = this.use_ground_removed;

		                if (res.length > 1 && res[1].length > 0)  {
		                    annotation = parsePythonJSON(res[1]);
		                    bounding_boxes_json = Object.values(annotation["frame"]["bounding_boxes"]);
		                    bounding_boxes = Box.parseJSON(bounding_boxes_json);
		                    for (var i = 0; i < bounding_boxes.length; i++) {
		                        box = bounding_boxes[i];
		                        frame.bounding_boxes.push(box);
		                        box.add_text_label();
		                        frame.annotated = true;
		                    }
		                }
		                this.frames[fname] = frame; // Salva in cache
		                
		                this.load_frame_clusters(frame);
		            }

		            this.predict_next_frame_bounding_box(this.get_prev_fname(fname));
		            
		            show(frame);
		            
		            this.updateAnnotationVisibility();
		        },
		        error: function(error) {
		            console.log(error);
		        }
		    });
		}
	};
	this.predict_next_frame_bounding_box = function(fname) {
        if (!enable_bounding_box_tracking) {
            return;
        }
        var cur_idx = this.fnames.indexOf(fname);
        if (cur_idx < 0 ||
            cur_idx >= this.fnames.length - 1 ||
            !this.frames[this.fnames[cur_idx]]) {
            return;
        }
        
        if (this.fnames[cur_idx].split("/")[0] != this.fnames[cur_idx+1].split("/")[0]) {
            return; 
        }

        var next_fname = this.fnames[cur_idx+1];
        var next_frame = this.frames[next_fname];
        var prev_frame = this.frames[fname];

        if (next_frame.is_annotated()) {
            return;
        }


        $.ajax({
            context: this,
            url: '/predictNextFrameBoundingBoxes',
            data: JSON.stringify({fname: fname}),
            type: 'POST',
            contentType: 'application/json;charset=UTF-8',
            success: function(response) {
                var res = response.split("\'").join("\"");
                res = JSON.parse(res);
                
                var old_boxes_map = {};
                for (var i = 0; i < prev_frame.bounding_boxes.length; i++) {
                    var b = prev_frame.bounding_boxes[i];
                    old_boxes_map[b.id] = b;
                }

                // --- THE SMART TIMESHIFT ---
                // We wrap the box-creation logic in a function so it can pause itself
                var applyTrackingWhenReady = function() {
                    
                    // If the clusters haven't arrived from Python yet, wait 50ms and try again!
                    if (!next_frame.clusters_loaded || !next_frame.cluster_metadata) {
                        console.log("Timeshift: Waiting 50ms for clusters to load...");
                        setTimeout(applyTrackingWhenReady, 50);
                        return; // Stop executing for now
                    }

                    // Once we pass the check above, the clusters are GUARANTEED to be here.
                    for (var box_id_str in res) {
                        if (res.hasOwnProperty(box_id_str)) {
                            var json_box = res[box_id_str];
                            var box_id = parseInt(box_id_str);
                            var old_box = old_boxes_map[box_id];

                            var corner1 = new THREE.Vector3(json_box.corner1[1], app.eps, json_box.corner1[0]);
                            var corner2 = new THREE.Vector3(json_box.corner2[1], 0, json_box.corner2[0]);
                            
                            var box = createBox(corner1, corner2, json_box['angle']);
                            box.id = box_id;
                            
                            if (old_box) {
                                box.object_id = old_box.object_id;
                                
                                // Inherit dimensions and ground
                                var old_w = distance2D(old_box.geometry.vertices[0], old_box.geometry.vertices[2]);
                                var old_l = distance2D(old_box.geometry.vertices[1], old_box.geometry.vertices[2]);
                                var old_h = old_box.boundingBox.max.y - old_box.boundingBox.min.y;
                                
                                box.GROUND_HEIGHT = old_box.GROUND_HEIGHT;
                                box.setDimensions(old_w, old_l, old_h);
                                if (old_box.base_color) {
                                    box.base_color = old_box.base_color;
                                    box.changeBaseColor(box.base_color);
                                    box.changeBoundingBoxColor(box.base_color);
                                }

                            }

                            next_frame.bounding_boxes.push(box);
                            box.add_text_label();
                            
                            // Now we can safely validate because we forced it to wait!
                            box.validateAssociatedCluster();
                            
                            if (app.cur_frame === next_frame) {
                                scene.add(box.points);
                                scene.add(box.boxHelper);
                                if (typeof addObjectRow === "function") {
                                    addObjectRow(box);
                                    if (box.object_id) {
                                        var select = $(OBJECT_TABLE).find(".object_row_id:contains('" + box.id + "')").closest("tr").find("select");
                                        select.val(box.object_id);
                                    }
                                }
                            }
                        }
                    }
                    next_frame.annotated = true;
                    
                    // Force UI to update the newly validated red/white text colors
                    if (typeof render === 'function') render();
                };

                // Kick off the loop
                applyTrackingWhenReady();
            },
            error: function(error) {
                console.log("Errore nel tracking backend: ", error);
            }
        });
    };
 
	this.get_pointcloud_data = function(fname) {
		if (fname in this.frames) {
			return this.frames[fname].data;
		} else {
			var frame = this.get_frame(fname);
			return frame.data;
		}
		
	};


	this.getCursor = function() {
		return get3DCoord();
	}

	this.handleBoxRotation = function() {
		if (mouseDown && isRotating) {
			rotatingBox.rotate(this.getCursor());
			rotatingBox.add_timestamp();
		}
	}

	this.handleBoxResize = function() {
		if (!isResizing) {return;}
		if (mouseDown) {
			var cursor = app.getCursor();
			cursor.y -= this.eps;
			resizeBox.resize(cursor);
			resizeBox.add_timestamp();
			
			if(resizeBox.object_id != 'UNKNOWN')
			{
			    resizeBox.object_id = 'UNKNOWN'; 
			    
			    resizeBox.changeBaseColor(0xffffff);
			    
			    var row = getRow(resizeBox.id);
			    
			    if (row) {
				$(row).find('select').val('UNKNOWN');
	
			    }
			    this.increment_label_count();
			}
			
		} else {
           
		    predictBox = resizeBox;

		}
	}
	

	this.handleBoxMove = function() {
		if (mouseDown && isMoving) {
			var cone = false;
			var height;
			if(selectedBox.object_id.indexOf("SMALL") !== -1){
			    height = 0.325;
			    cone = true;
			}else if(selectedBox.object_id.indexOf("BIG") !== -1){
			    height = 0.505;
			    cone = true;
			}
			selectedBox.translate(this.getCursor(), height, cone)
			selectedBox.changeBoundingBoxColor(selected_color.clone());
			selectedBox.add_timestamp();
		}
	}

	this.handleAutoDraw = function() {
		if (autoDrawMode && enable_one_click_annotation) {
			var clickPoint = app.getCursor().clone();
			$.ajax({
				context: this,
				url: '/predictBoundingBox',
				type: 'POST',
				contentType: 'application/json;charset=UTF-8',
				data: JSON.stringify({fname: this.cur_frame.fname, point: clickPoint}),
				success: function(response) {
					var str = response.replace(/'/g, "\"");
					var res = JSON.parse(str);
	
					var corner1 = new THREE.Vector3(res.corner1[1], this.eps, res.corner1[0]);
					var corner2 = new THREE.Vector3(res.corner2[1], 0, res.corner2[0]);

					var box = createAndDrawBox(corner1, corner2,res['angle']);
					addBox(box);
				},
				error: function(error) {
					console.log(error);
				}
			});
		}
	}

	this.get_prev_frame = function() {
		var cur_idx = this.fnames.indexOf(this.cur_frame.fname);
		if (cur_idx == 0 || !(this.fnames[cur_idx - 1] in this.frames)) {
			return null;
		}
		var prev_frame = this.frames[this.fnames[cur_idx - 1]];
		return prev_frame;
	}

	this.show_previous_frame_bounding_box = function() {
		var prev_frame = this.get_prev_frame();
		if (!prev_frame) {
			return;
		}
		if (!this.show_prev_frame) {
			this.show_prev_frame = true;
			prev_frame.scene_add_frame_bounding_box();
			
		} else if (this.show_prev_frame) {
			this.show_prev_frame = false;
			console.log("remove");
			prev_frame.scene_remove_frame_children();
		}
	}

	this.write_frame_out = function() {
		if (this.cur_frame) {
			this.cur_frame.evaluator.pause_recording();
			var output_frame = this.cur_frame.output();
			var output = {"frame": output_frame};
			var stringifiedOutput = JSON.stringify(output);
			$.ajax({
				url: '/writeOutput',
				data: JSON.stringify({output: {filename: this.cur_frame.fname, 
												file: stringifiedOutput}}),
				type: 'POST',
				contentType: 'application/json;charset=UTF-8',
				success: function(response) {
					console.log("successfully saved output")
				},
				error: function(error) {
					console.log(error);
				}
			});
		}
	}

	this.render_text_labels = function() {
		if (app.cur_frame) {
			for (var i = 0; i < app.cur_frame.bounding_boxes.length; i++) {
				var box = app.cur_frame.bounding_boxes[i];
				if (box.text_label) {
					box.text_label.updatePosition();
				}
			}

			if (app.show_prev_frame) {
				var prev_frame = this.get_prev_frame();
				if (!prev_frame) {
					return;
				}
				for (var i = 0; i < prev_frame.bounding_boxes.length; i++) {
					var box = prev_frame.bounding_boxes[i];
					if (box.text_label) {
						box.text_label.updatePosition();
					}
				}
			}
		}
	}

	this.generate_new_box_id = function() {
		if (app.cur_frame) {
			var box_ids = [];
			for (var i = 0; i < app.cur_frame.bounding_boxes.length; i++) {
				box_ids.push(app.cur_frame.bounding_boxes[i].id);
			}
			if (box_ids.length > 0) {
				return Math.max.apply(Math, box_ids) + 1;
			}
		}
		return 0;
	}

	this.get_Mask_RCNN_Labels = function(fname) {
		console.log(enable_mask_rcnn, this.frames[fname].mask_rcnn_indices.length > 0);
	if (!enable_mask_rcnn || this.frames[fname].mask_rcnn_indices.length > 0) {return;}
		this.lock_frame = true;
		$.ajax({
			context: this, 
			url: '/getMaskRCNNLabels',
			data: JSON.stringify({fname: fname}),
			type: 'POST',
			contentType: 'application/json;charset=UTF-8',
			success: function(response) {
				var l = response.length - 1;
				maskRCNNIndices = response.substring(1, l).split(',').map(Number);
				// console.log(maskRCNNIndices);
				// console.log(response);
				this.frames[fname].mask_rcnn_indices = maskRCNNIndices;
				highlightPoints(maskRCNNIndices);
				updateMaskRCNNImagePanel();
				this.lock_frame = false;
			},
			error: function(error) {
				console.log(error);
				this.lock_frame = false;
			}
		});
	}

	this.pause_3D_time = function() {
		if (this.cur_frame && isRecording) {
			this.cur_frame.evaluator.pause_3D_time();
		}
	}
	this.increment_label_count = function() {
		if (this.cur_frame && isRecording) {
			this.cur_frame.evaluator.increment_label_count();
		}
	}

	this.decrement_label_count = function() {
		if (this.cur_frame && isRecording) {
			this.cur_frame.evaluator.decrement_label_count();
		}
	}

	this.increment_add_box_count = function() {
		if (this.cur_frame && isRecording) {
			this.cur_frame.evaluator.increment_add_box_count();
		}
	}

	this.increment_translate_count = function() {
		if (this.cur_frame && isRecording) {
			this.cur_frame.evaluator.increment_translate_count();
		}
	}

	this.increment_rotate_count = function() {
		if (this.cur_frame && isRecording) {
			this.cur_frame.evaluator.increment_rotate_count();
		}
	}

	this.increment_rotate_camera_count = function() {
		if (this.cur_frame && isRecording) {
			this.cur_frame.evaluator.increment_rotate_camera_count(camera.rotation.z);
		}
	}

	this.increment_resize_count = function() {
		if (this.cur_frame && isRecording) {
			this.cur_frame.evaluator.increment_resize_count(camera.rotation.z);
		}
	}

	this.increment_delete_count = function() {
		if (this.cur_frame && isRecording) {
			this.cur_frame.evaluator.increment_delete_count();
		}
	}

	this.resume_3D_time = function() {
		if (this.cur_frame && isRecording) {
			this.cur_frame.evaluator.resume_3D_time();
		}
	}

	this.pause_recording = function() {
		if (this.cur_frame && isRecording) {
			this.cur_frame.evaluator.pause_recording();
		}
	}

	this.resume_recording = function() {
		if (this.cur_frame && isRecording) {
			this.cur_frame.evaluator.resume_recording();
		}
	}

	this.set_controls = function(fname) {
		var i = this.controls[fname];
		console.log("asdf, ", i);
		if (i == 0) {
			enable_predict_label = false;
			enable_mask_rcnn = false;
			enable_one_click_annotation = false;
			enable_bounding_box_tracking = false;
		} else if (i == 1) {
			enable_predict_label = true;
			enable_mask_rcnn = true;
			enable_one_click_annotation = false;
			enable_bounding_box_tracking = false;
		} else if (i == 2) {
			enable_predict_label = false;
			enable_mask_rcnn = false;
			enable_one_click_annotation = true;
			enable_bounding_box_tracking = false;
		} else if (i == 3) {
			enable_predict_label = false;
			enable_mask_rcnn = false;
			enable_one_click_annotation = false;
			enable_bounding_box_tracking = true;
		} else if (i == 4) {
			enable_predict_label = true;
			enable_mask_rcnn = true;
			enable_one_click_annotation = true;
			enable_bounding_box_tracking = true;
		} else if (i == 5) {
			enable_predict_label = true;
			enable_mask_rcnn = true;
			enable_one_click_annotation = true;
			enable_bounding_box_tracking = true;
		}
	}

}

function parsePythonJSON(json) {
    var formattedStr = json.split("\'").join("\"");
    
    // Translate Python keywords to valid JSON keywords
    formattedStr = formattedStr.replace(/None/g, "null");
    formattedStr = formattedStr.replace(/False/g, "false");
    formattedStr = formattedStr.replace(/True/g, "true");
    
    return JSON.parse(formattedStr);
}

function show(frame) {
	var initPointCloud;

	if (app.cur_frame) {
		clearObjectTable();
	}
	app.cur_frame = frame;
	if (app.cur_pointcloud == null) {
		initPointCloud = true;
	}
	// add pointcloud to scene
	generatePointCloud();

	if (initPointCloud) {
		animate();
	}
	app.cur_frame.scene_add_frame_children();
	loadObjectTable();
	switchMoveMode();
	
	// Questo loop forza l'applicazione del colore salvato (base_color)
	// a tutti i box appena aggiunti alla scena.
	
	if (app.cur_frame.bounding_boxes) {
	    for (var i = 0; i < app.cur_frame.bounding_boxes.length; i++) {
			var box = app.cur_frame.bounding_boxes[i];
				
			// Se il box ha un colore base salvato, applicalo
			if (box.base_color) {
				// 1. Applica colore alle linee del box
				box.changeBoundingBoxColor(box.base_color);

			}
	    }
	}


}
