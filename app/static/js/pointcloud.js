function normalizeColors(vertices, color) {
    var maxColor = Number.NEGATIVE_INFINITY;
    var minColor = Number.POSITIVE_INFINITY;
    var intensities = [];
    var colors = app.cur_pointcloud.geometry.colors;
    var k = 0;
    
    // 1. Estrazione Intensità (Indice 3)
    for ( var i = 0, l = vertices.length / DATA_STRIDE; i < l; i ++ ) {
        var val = vertices[ DATA_STRIDE * k + 3 ]; 
        if (val > maxColor) {
            maxColor = val;
        }
        if (val < minColor) {
            minColor = val;
        }
        intensities.push(val);
        k++;
    }

    var mean = calculateMean(intensities);
    var sd = standardDeviation(intensities);
    var filteredIntensities = filter(intensities, mean, 1 * sd);
    var min = getMinElement(filteredIntensities);
    var max = getMaxElement(filteredIntensities);
    
    var intensity;
    for ( var i = 0;  i < app.cur_pointcloud.geometry.vertices.length; i ++ ) {
        intensity = intensities[i];
        if (i < intensities.length) {
            // "Taglia" i valori estremi per mantenere alto il contrasto
            if (intensities[i] - mean >= 2 * sd) {
                intensity = 1.0;
            } else if (mean - intensities[i] >= 2 * sd) {
                intensity = 0.0;
            } else {
                intensity = (intensities[i] - min) / (max - min);
            }
        } else {
            intensity = 0.0;
        }
        
        // --- COLORMAPPING STILE RVIZ (JET/RAINBOW) ---
        // Hue (Tinta): 0.66 è Blu (bassa intensità), 0.0 è Rosso (alta intensità).
        var hue = (1.0 - intensity) * 0.66; 
        
        // setHSL accetta (Tinta, Saturazione, Luminosità).
        // Saturazione al 100% (1.0) per colori super vividi.
        // Luminosità fissa al 50% (0.5) che è il "vero" colore in HSL.
        colors[i].setHSL(hue, 1.0, 0.5);
        
        app.cur_pointcloud.geometry.colorsNeedUpdate = true;
    }
    
    return colors;
}
function highlightPoints(indices) {
    var pointcloud = app.cur_pointcloud;
    for (var j = 0; j < indices.length; j++) {
        pointcloud.geometry.colors[indices[j]] = new THREE.Color(0x00ff6b);
    }
    pointcloud.geometry.colorsNeedUpdate = true;
}

function generateNewPointCloud( vertices, color ) {
    var geometry = new THREE.Geometry();
    var colors = [];
    var k = 0;
    for ( var i = 0, l = vertices.length / DATA_STRIDE; i < l; i ++ ) {
        // creates new vector from a cluster and adds to geometry
        var v = new THREE.Vector3( vertices[ DATA_STRIDE * k + 1 ], 
            vertices[ DATA_STRIDE * k + 2 ], vertices[ DATA_STRIDE * k ] );

        // add vertex to geometry
        geometry.vertices.push( v );
        colors.push(color.clone());
        k++;
    }
    geometry.colors = colors;
    geometry.computeBoundingBox();

    var material = new THREE.PointsMaterial( { size: pointSize, sizeAttenuation: false, vertexColors: THREE.VertexColors } );
    // creates pointcloud given vectors
    var pointcloud = new THREE.Points( geometry, material );
    app.cur_pointcloud = pointcloud;
    normalizeColors(vertices, color);
    return pointcloud;
}

function updatePointCloud( vertices, color ) {
    var k = 0;
    var n = vertices.length;
    var l = app.cur_pointcloud.geometry.vertices.length;
    var geometry = app.cur_pointcloud.geometry
    var v;
    for ( var i = 0; i < n / DATA_STRIDE; i ++ ) {
        if (i >= l) {
            v = new THREE.Vector3( vertices[ DATA_STRIDE * k + 1 ], 
                app.cur_frame.ys[k], vertices[ DATA_STRIDE * k ] );
            geometry.vertices.push(v);
            geometry.colors.push(color.clone());

            geometry.verticesNeedUpdate = true;
            geometry.colorsNeedUpdate = true;
        } else {
            v = geometry.vertices[k];
            v.setX(vertices[ DATA_STRIDE * k + 1 ]);
            v.setY(app.cur_frame.ys[k]);
            v.setZ(vertices[ DATA_STRIDE * k ]);
            geometry.verticesNeedUpdate = true;
        }
        k++;
    }
    normalizeColors(vertices, null);
    geometry.computeBoundingBox();
    console.log("fii");
    if (app.cur_frame != null && app.cur_frame.mask_rcnn_indices.length > 0) {
        highlightPoints(app.cur_frame.mask_rcnn_indices);
    }

    return app.cur_pointcloud;
}
