function Box(anchor, cursor, angle, boundingBox, boxHelper) {
    this.id = app.generate_new_box_id(); // id (int) of Box
    this.object_id = 'UNKNOWN'; // object id (string)
    this.color = hover_color.clone(); // color of corner points
    this.angle = angle; // orientation of bounding box
    this.anchor = anchor; // point where bounding box was created
    this.cursor = cursor.clone(); // cursor
    this.added = false; // (boolean) whether the box has been added to boundingboxes
    this.boundingBox = boundingBox; // Box3; sets the size of the box
    this.boxHelper = boxHelper; // BoxHelper; helps visualize the box
    this.geometry = new THREE.Geometry(); // geometry for corner/rotating points
    this.base_color = 0xffffff;
    this.associatedClusterIdx = null;
    this.GROUND_HEIGHT = 0;

    // visualizes the corners (in the non-rotated coordinates) of the box
    this.points = new THREE.Points( this.geometry, pointMaterial );
    this.points.frustumCulled = false; // allows 
    this.timestamps = [];
    
    this.colors = []; // colors of the corner points

    // add colors to points geometry
    for (var i = 0; i < 6; i++) {
        this.colors.push( this.color.clone().multiplyScalar( 7 ) );
    }
    this.geometry.colors = this.colors;
    
    // order of corners is max, min, topleft, bottomright
    this.geometry.vertices.push(anchor);
    this.geometry.vertices.push(cursor);
    this.geometry.vertices.push(anchor.clone());
    this.geometry.vertices.push(cursor.clone());
    this.geometry.vertices.push(getCenter(anchor.clone(), cursor.clone()));

    this.hasPredictedLabel = false;
    this.text_label;

    this.get_center = function() {
        var center3D = getCenter(this.geometry.vertices[0], this.geometry.vertices[1]);
        return new THREE.Vector2(center3D.z, center3D.x);
    }
    
    this.validateAssociatedCluster = function() {
        // Ensure the global app has loaded the clusters for the current frame
        if (!app.cur_frame || !app.cur_frame.cluster_metadata) {
            // this.associatedClusterIdx = null;
            return;
        }

        var MAX_RADIUS = 0.3; 
        var TOLERANCE = 0.3;

        var closestIdx = null; 
        var minDistance = Infinity;
        var count_close = 0;
        
        // Use the box's actual calculated center, not just the top-left vertex
        var center3D = getCenter(this.geometry.vertices[0], this.geometry.vertices[1]);
        
        for (var j = 0; j < app.cur_frame.cluster_metadata.length; j++) {
            var cluster = app.cur_frame.cluster_metadata[j];
            
            // Note: LATTE often uses X/Z for the ground plane. 
            // The cluster x/y from Python maps to X/Z in Three.js
            var dx = center3D.z - cluster.x;
            var dy = center3D.x - cluster.y; 
            var distance = Math.sqrt(dx*dx + dy*dy);

            if (distance <= MAX_RADIUS) {
                // Calculate actual width/length based on the vertices
                var currentWidth = distance2D(this.geometry.vertices[1], this.geometry.vertices[2]);
                var currentLength = distance2D(this.geometry.vertices[0], this.geometry.vertices[2]);
                var maxBoxDim = Math.max(currentWidth, currentLength);
                var minBoxDim = Math.min(currentWidth, currentLength);

                if (cluster.w <= maxBoxDim + TOLERANCE && cluster.l <= maxBoxDim + TOLERANCE &&
                	cluster.w >= minBoxDim - TOLERANCE && cluster.l >= minBoxDim - TOLERANCE) {
                	
                    minDistance = distance;
                    closestIdx = cluster.idx;
                    count_close++;
                }
            }
        }
        if(count_close == 1)
        	this.associatedClusterIdx = closestIdx;
        else
        	this.associatedClusterIdx = null;
        
        if (this.text_label && this.text_label.element) {
            if (this.associatedClusterIdx === null) {
                // Missing/Ambiguous Cluster: Turn text Red and make it bold so it stands out
                this.text_label.element.style.color = '#ff0000';
                this.text_label.element.style.fontWeight = 'bold';
            } else {
                // Valid Cluster: Turn text White and reset weight
                this.text_label.element.style.color = '#ffffff';
                this.text_label.element.style.fontWeight = 'normal';
            }
        }
        var _this = this; // store reference to the box
		$.ajax({
		    url: '/getClusterMinZ',
		    type: 'POST',
		    contentType: 'application/json;charset=UTF-8',
		    data: JSON.stringify({ fname: app.cur_frame.fname, cluster_idx: _this.associatedClusterIdx }),
		    success: function(response) {
		        if (response.status === "success") {
		            _this.GROUND_HEIGHT = response.min_z;
		            
		            
                    var height = (_this.object_id.indexOf("UNKNOWN") == -1) ? ((_this.object_id.indexOf("BIG") == -1) ? 																									0.325 : 0.505) :
                    															0.00001;
                    
                    // 3. Update ONLY the vertical limits of the 3D bounding box
                    _this.boundingBox.min.y = _this.GROUND_HEIGHT;
                    _this.boundingBox.max.y = _this.GROUND_HEIGHT + height;
                    
                    // 4. Force Three.js to redraw the yellow outline at the new height
                    if (_this.boxHelper && _this.boxHelper.update) {
                        _this.boxHelper.update();
                    }
                }
            }
        });
        updateLabelStats();
    }
   
    // method for resizing bounding box given cursor coordinates
    // 
    // since BoxHelper3 draws a box in the same orientation as that of the point cloud, 
    // we take the anchor and cursor, rotate them by the angle of the camera, draw the box, 
    // then rotate the box back
    this.resize = function(cursor, validate_cluster=true) {
    	//if(!can_modify)return;
        // checks and executes only if anchor does not overlap with cursor to avoid 0 determinant
        if (cursor.x != this.anchor.x && cursor.y != this.anchor.y && cursor.z != this.anchor.z) {

            var v1 = cursor.clone();
            var v2 = this.anchor.clone();

            v1.y = 0;
            v2.y = 0;
            
            // rotate cursor and anchor
            rotate(v1, v2, this.angle);

            // calculating corner points and rotating point
            var minVector = getMin(v1, v2);
            var maxVector = getMax(v1, v2);
            var topLeft = getTopLeft(v1, v2);
            var bottomRight = getBottomRight(v1, v2);
            var topCenter = getCenter(topLeft, maxVector);
            var bottomCenter = getCenter(minVector, bottomRight);

            // need to do this to make matrix invertible
            //maxVector.y = 0.00001; 

            // setting bounding box limits
            //this.boundingBox.set(minVector.clone(), maxVector.clone());
            
            this.boundingBox.min.set(minVector.x, this.GROUND_HEIGHT, minVector.z);
			this.boundingBox.max.set(maxVector.x, this.GROUND_HEIGHT+0.00001, maxVector.z);

            // rotate BoxHelper back
            this.boxHelper.rotation.y = this.angle;

            // setting y coordinate back to zero since we are done with drawing
            maxVector.y = 0;

            // rotate back the corner points
            rotate(minVector, maxVector, -this.angle);
            rotate(topLeft, bottomRight, -this.angle);
            rotate(topCenter, bottomCenter, -this.angle);

            // set updated corner points used to resize box
            this.geometry.vertices[0] = maxVector.clone();
            this.geometry.vertices[1] = minVector.clone();
            this.geometry.vertices[2] = topLeft.clone();
            this.geometry.vertices[3] = bottomRight.clone();
            this.geometry.vertices[4] = bottomCenter.clone();

            // tell scene to update corner points
            this.geometry.verticesNeedUpdate = true;
            
            if(validate_cluster){
        		this.validateAssociatedCluster();
        	}
        }
    }
    
    // --- MODIFICA FORMULA STUDENT: Ridimensionamento Esplicito ---
    this.setDimensions = function(width, length, height, validate_cluster=true) {
        // 1. Calcoliamo il CENTRO ATTUALE del box (coordinate globali)
        // Usiamo i vertici opposti (0 e 1) per trovare il punto medio
        var v0 = this.geometry.vertices[0];
        var v1 = this.geometry.vertices[1];
        
        var center = getCenter(this.geometry.vertices[0], this.geometry.vertices[1]);

        // 2. Aggiorniamo il "Guscio Giallo" (BoxHelper)
        // Questo definisce la dimensione VISIVA del cubo.
        // Lavoriamo in spazio LOCALE (non ruotato), quindi usiamo +/- metà dimensione
        var hw = width / 2.0;  // Half Width
        var hl = length / 2.0; // Half Length
        
        // Qui definiamo il volume 3D: da Y=0 a Y=height
        this.boundingBox.min.set(-hw + center.x, this.GROUND_HEIGHT, -hl+center.z);
        this.boundingBox.max.set(hw + center.x, this.GROUND_HEIGHT+height, hl+center.z);

        // 3. Ricalcoliamo i 4 vertici rossi (Geometry)
        // Creiamo i 4 angoli relativi al centro (0,0), poi li ruotiamo e trasliamo
        
        // Angoli locali (senza rotazione)
        // Nota: L'ordine dei vertici in LATTE è un po' particolare, cerchiamo di rispettarlo
        // 0: Max, 1: Min, 2: TopLeft, 3: BottomRight
        var c0 = new THREE.Vector3(hw, 0, hl);   // (+, +)
        var c1 = new THREE.Vector3(-hw, 0, -hl); // (-, -)
        var c2 = new THREE.Vector3(-hw, 0, hl);  // (-, +)
        var c3 = new THREE.Vector3(hw, 0, -hl);  // (+, -)

        // Rotazione (attorno all'asse Y verticale)
        var axis = new THREE.Vector3(0, 1, 0);
        c0.applyAxisAngle(axis, this.angle);
        c1.applyAxisAngle(axis, this.angle);
        c2.applyAxisAngle(axis, this.angle);
        c3.applyAxisAngle(axis, this.angle);

        // Traslazione (Portiamo i punti al centro calcolato prima)
        c0.add(center);
        c1.add(center);
        c2.add(center);
        c3.add(center);

        // 4. Applichiamo i nuovi vertici alla geometria
        this.geometry.vertices[0].copy(c0);
        this.geometry.vertices[1].copy(c1);
        this.geometry.vertices[2].copy(c2);
        this.geometry.vertices[3].copy(c3);
        
        // Aggiorniamo il punto di controllo (bottom center - usato per ruotare)
        // Punto medio tra c1 e c3
        var bottomCenter = new THREE.Vector3().addVectors(c1, c3).multiplyScalar(0.5);
        this.geometry.vertices[4].copy(bottomCenter);

        // 5. Notifichiamo Three.js degli aggiornamenti
        this.geometry.verticesNeedUpdate = true;
        //this.boxHelper.update(); // Fondamentale per vedere il cubo giallo cambiare
        
        if(validate_cluster){
        	this.validateAssociatedCluster();
        }
    }

    // method to rotate bounding box by clicking and dragging rotate point, 
    // which is the top center point on the bounding box
    this.rotate = function(cursor) {
        // get corner points
        var maxVector = this.geometry.vertices[0].clone();
        var minVector = this.geometry.vertices[1].clone();
        var topLeft = this.geometry.vertices[2].clone();
        var bottomRight = this.geometry.vertices[3].clone();
        var topCenter = getCenter(maxVector, topLeft);
        var bottomCenter = this.geometry.vertices[4].clone();

        // get relative angle of cursor with respect to 
        var center = getCenter(maxVector, minVector);
        var angle = getAngle(center, bottomCenter, cursor, topCenter);

        // update angle of Box and bounding box
        this.angle = this.angle + angle;
        this.boxHelper.rotation.y = this.angle;

        // rotate and update corner points
        rotate(minVector, maxVector, -angle);
        rotate(topLeft, bottomRight, -angle);
        rotate(topCenter, bottomCenter, -angle);

        this.geometry.vertices[0] = maxVector.clone();
        this.geometry.vertices[1] = minVector.clone();
        this.geometry.vertices[2] = topLeft.clone();
        this.geometry.vertices[3] = bottomRight.clone();
        this.geometry.vertices[4] = bottomCenter.clone();

        // tell scene to update corner points
        this.geometry.verticesNeedUpdate = true;
        
    }

    // method to translate bounding box given a reference point
    this.translate = function(v, height, cone, validate_cluster=true) {
        // get difference in x and z coordinates between cursor when 
        // box was selected and current cursor position
        var dx = v.x - this.cursor.x;
        var dz = v.z - this.cursor.z;

        // update all points related to box by dx and dz
        this.anchor.x += dx;
        this.anchor.z += dz;
        this.cursor = v.clone();
        for (var i = 0; i < this.geometry.vertices.length; i++) {
            var p = this.geometry.vertices[i];
            p.x += dx;
            p.z += dz;
        }

		// shift bounding box given new corner points
		var maxVector = this.geometry.vertices[0].clone();
		var minVector = this.geometry.vertices[1].clone();
		var topLeft = this.geometry.vertices[2].clone();
		var bottomRight = this.geometry.vertices[3].clone();
		var topCenter = getCenter(maxVector, topLeft);
		var bottomCenter = this.geometry.vertices[4].clone();

		rotate(maxVector, minVector, this.angle);
		rotate(topLeft, bottomRight, this.angle);
		rotate(topCenter, bottomCenter, this.angle);

		if(!cone){
			// need to do this to make matrix invertible
			this.boundingBox.min.set(minVector.x, this.GROUND_HEIGHT, minVector.z);
			this.boundingBox.max.set(maxVector.x, this.GROUND_HEIGHT+0.00001, maxVector.z);
		}else{
			// Qui definiamo il volume 3D: da Y=0 a Y=height
			this.boundingBox.min.set(minVector.x, this.GROUND_HEIGHT, minVector.z);
			this.boundingBox.max.set(maxVector.x, this.GROUND_HEIGHT+height, maxVector.z);
		}

        // tell scene to update corner points
        this.geometry.verticesNeedUpdate = true;
        if(validate_cluster){
        	this.validateAssociatedCluster();
        }
    }

    // method to highlight box given cursor
    this.select = function(cursor) {
        selectedBox = this;
        if (this && cursor) {
            selectedBox.cursor = cursor;
        }
        updateHoverBoxes(cursor);
        // this.changeBoundingBoxColor(new THREE.Color( 0,0,7 ) );
        this.changeBoundingBoxColor(selected_color);
    }


    // changes and updates a box's point's color given point index and color
    this.changePointColor = function(idx, color) {
        this.colors[idx] = color;
        this.geometry.colorsNeedUpdate = true;
    }
    // method to change color of bounding box
    this.changeBoundingBoxColor = function(color) {
        boxHelper.material.color.set(color);
    }
    
    this.changeBaseColor = function(color){
    	this.base_color = color;
    }

    this.output = function() {
        return new OutputBox(this);
    }

    this.get_cursor_distance_threshold = function() {
        return Math.min(distance2D(this.geometry.vertices[0], this.geometry.vertices[2]),
            distance2D(this.geometry.vertices[0], this.geometry.vertices[1])) / 4;
    }

    this.set_box_id = function(box_id) {
        if (typeof(box_id) == 'string') {
            box_id = parseInt(box_id);
        }
        this.id = box_id;
        this.text_label.setHTML(this.id.toString());
    }

    this.add_timestamp = function() {
        this.timestamps.push(Date.now());
    }

    this.add_text_label = function() {
        var text = this.create_text_label();
        text.setHTML(this.id.toString());
        text.setParent(this.boxHelper);
        container.appendChild(text.element);
        this.text_label = text;
        
        if (this.associatedClusterIdx == null) {
            this.text_label.element.style.color = '#ff0000';
            this.text_label.element.style.fontWeight = 'bold';
        } else {
            this.text_label.element.style.color = '#ffffff';
            this.text_label.element.style.fontWeight = 'normal';
        }
    }

    this.create_text_label = function() {
        var div = document.createElement('div');
        div.className = 'text-label';
        div.style.position = 'absolute';
        div.style.width = 100;
        div.style.height = 100;
        div.innerHTML = "hi there!";
        div.style.top = -1000;
        div.style.left = -1000;
    
        var _this = this;
    
        return {
          element: div,
          parent: false,
          position: new THREE.Vector3(0,0,0),
          setHTML: function(html) {
            this.element.innerHTML = html;
          },
          setParent: function(threejsobj) {
            this.parent = threejsobj;
          },
          updatePosition: function() {
            if (this.parent) {
              this.position.copy(this.parent.position);
            }            
            var coords2d = this.get2DCoords(this.position, camera);
            this.element.style.left = coords2d.x + 'px';
            this.element.style.top = coords2d.y + 'px';
          },
          get2DCoords: function(position, camera) {
            var vector = position.project(camera);
            vector.x = (vector.x + 1)/2 * window.innerWidth;
            vector.y = -(vector.y - 1)/2 * window.innerHeight;
            return vector;
          }
        };
    }
}

Box.parseJSON = function(json_boxes) {
    var bounding_boxes = [], box;
    var json_box, center, top_right, bottom_left;
    var w, l, cx, cy, angle;
    
    if (!Array.isArray(json_boxes)) {
        json_boxes = [json_boxes];
    }
    
    for (var i = 0; i < json_boxes.length; i++) {
        json_box = json_boxes[i];
        
        w = json_box['width'];
        l = json_box['length'];
        cx = json_box['center']['x'];
        cy = json_box['center']['y'];
        angle = json_box['angle'];
        
        top_right = new THREE.Vector3(cy + l / 2, app.eps, cx + w / 2);
        bottom_left = new THREE.Vector3(cy - l / 2, 0, cx - w / 2);
        center = getCenter(top_right, bottom_left);
        
        rotate(top_right, bottom_left, -angle);
        box = createBox(top_right, bottom_left, angle, false);
        
        if (json_box.hasOwnProperty('box_id')) {
            box.id = json_box.box_id;
        }

        // --- NEW: Load Ground Height and Cluster ID ---
        if (json_box.hasOwnProperty('ground') && json_box['ground'] !== null) {
            box.GROUND_HEIGHT = json_box['ground'];
        }

        if (json_box.hasOwnProperty('associated_cluster_idx')) {
            box.associatedClusterIdx = json_box['associated_cluster_idx'];
        }

        // --- GESTIONE COLORE E DIMENSIONI ---
        var colorHex = 0xffffff; 
        var height = 0.00001;        

        if (json_box.hasOwnProperty('object_id')) {
            box.object_id = json_box.object_id;
            
            if (box.object_id.indexOf("SMALL") !== -1) {
                height = 0.325;
                if (box.object_id.indexOf("blue") !== -1) {
                    colorHex = 0x0000ff; 
                } else if (box.object_id.indexOf("yellow") !== -1) {
                    colorHex = 0xffff00; 
                } else if (box.object_id.indexOf("orange") !== -1) {
                    colorHex = 0xff7f00; 
                }
                
                // Because we loaded box.GROUND_HEIGHT above, this will position it perfectly!
                box.setDimensions(w, l, height, false);

            } else if (box.object_id.indexOf("BIG") !== -1) {
                height = 0.505;
                colorHex = 0xff7f00; 
                box.setDimensions(w, l, height, false);
            }
            else {
                box.setDimensions(w, l, height, false);
            }
        }
        
        box.changeBaseColor(colorHex);
        
        bounding_boxes.push(box);
    }
    return bounding_boxes;
}

// gets angle between v1 and v2 with respect to origin
//
// v3 is an optional reference point that should be v1's reflection about the origin, 
// but is needed to get the correct sign of the angle
function getAngle(origin, v1, v2, v3) {
    v1 = v1.clone();
    v2 = v2.clone();
    origin = origin.clone();
    v1.sub(origin);
    v2.sub(origin);
    v1.y = 0;
    v2.y = 0;
    v1.normalize();
    v2.normalize();

    var angle = Math.acos(Math.min(1.0, v1.dot(v2)));
    if (v3) {
        v3 = v3.clone();
        v3.sub(origin);

        // calculates distance between v1 and v2 when v1 is rotated by angle
        var temp1 = v1.clone();
        rotate(temp1, v3.clone(), angle);
        var d1 = distance2D(temp1, v2);

        // calculates distance between v1 and v2 when v1 is rotated by -angle
        var temp2 = v1.clone();
        rotate(temp2, v3.clone(), -angle);
        var d2 = distance2D(temp2, v2);
        


        // compares distances to determine sign of angle
        if (d2 > d1) {
            angle = -angle;
        }
    }

    return angle;
}


// highlights closest corner point that intersects with cursor
function highlightCorners() {
    // get closest intersection with cursor
    var intersection = intersectWithCorner();
    if (intersection) {
        // get closest point and its respective box
        var box = intersection[0];
        var p = intersection[1];

        // get index of closest point
        var closestIdx = closestPoint(p, box.geometry.vertices);

        // if there was a previously hovered box, change its color back to red
        if (hoverBox) {
            // hoverBox.changePointColor(hoverIdx, new THREE.Color(7, 0, 0));
            hoverBox.changePointColor(hoverIdx, hover_color.clone());
        }

        // update hover box
        hoverBox = box;
        hoverIdx = closestIdx;
        // hoverBox.changePointColor(hoverIdx, new THREE.Color(0, 0, 7));
        hoverBox.changePointColor(hoverIdx, selected_color.clone());

    } else {

        // change color of previously hovered box back to red
        if (hoverBox) {
            // hoverBox.changePointColor(hoverIdx, new THREE.Color(7, 0, 0));
            hoverBox.changePointColor(hoverIdx, hover_color.clone());
        }

        // set hover box to null since there is no intersection
        hoverBox = null;
    }
}




// method to add box to boundingBoxes and object id table
// should only be called when you physically draw a box, 
// not for loading a frame
function addBox(box) {
    app.cur_frame.bounding_boxes.push(box);
    addObjectRow(box);
    box.add_text_label();
    updateLabelStats();
}

function stringifyBoundingBoxes(boundingBoxes) {
    var outputBoxes = [];
    for (var i = 0; i < boundingBoxes.length; i++) {
        outputBoxes.push(new OutputBox(boundingBoxes[i]));
    }
    return outputBoxes;
}

function createBox(anchor, v, angle, validate_cluster=true) {
    newBoundingBox = new THREE.Box3(v, anchor);
    newBoxHelper = new THREE.Box3Helper( newBoundingBox, 0xffffff );
    newBox = new Box(anchor, v, angle, newBoundingBox, newBoxHelper);
    newBox.resize(v, validate_cluster);
	newBox.angle = angle;
    return newBox;
}

function createAndDrawBox(anchor, v, angle) {
    var newBox = createBox(anchor, v, angle);
    drawBox(newBox);
    return newBox;
}

function drawBox(box) {
    scene.add(box.points);
    scene.add(box.boxHelper);
}

// deletes selected box when delete key pressed
function deleteSelectedBox() {
    if (app.editing_box_id) {return;}
    var boundingBoxes = app.cur_frame.bounding_boxes;
    if (selectedBox) {
        scene.remove(selectedBox.points);
        scene.remove(selectedBox.boxHelper);
        selectedBox.text_label.element.remove();

        // deletes corresponding row in object id table
        deleteRow(selectedBox.id);

        // removes selected box from array of currently hovered boxes
        for (var i = 0; i < hoverBoxes.length; i++) {
            if (hoverBoxes[i] == selectedBox) {
                hoverBoxes.splice(i, 1);
                break;
            }
        }

        // removes selected box from array of bounding boxes
        for (var i = 0; i < boundingBoxes.length; i++) {
            if (boundingBoxes[i] == selectedBox) {
                boundingBoxes.splice(i, 1);
                break;
            }
        }
        app.increment_delete_count();
        // removes selected box
        selectedBox = null;
        
        updateLabelStats();
    }
}


function OutputBox(box) {
    var v1 = box.geometry.vertices[0]; // Max
    var v2 = box.geometry.vertices[1]; // Min
    var v3 = box.geometry.vertices[2]; // TopLeft
    var center = getCenter(v1, v2);
    this.box_id = box.id;
    this.center = new THREE.Vector2(center.z, center.x);
    
    // THE FIX: Swap v1 and v2 in these two lines!
    this.width = distance2D(v1, v3);  // Max to TopLeft measures the X-axis (Width)
    this.length = distance2D(v2, v3); // Min to TopLeft measures the Z-axis (Length)
    
    this.angle = box.angle;
    this.object_id = box.object_id;
    // this.timestamps = box.timestamps;
    this.associated_cluster_idx = box.associatedClusterIdx;
    this.ground = box.GROUND_HEIGHT;
}
