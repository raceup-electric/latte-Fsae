var pointSize = 1.0; // Set a default starting size
var searchRadius = 0.5; // Default search radius for prediction

var SettingsControls = function() {
    this.size = pointSize;
    this.searchRadius = searchRadius;
    // Bind the functions to the app context if it exists, otherwise do nothing safely
    this.toggleGround = function() { if (typeof app !== 'undefined') app.toggleGroundRemoved(); };
    this.toggleAnnotations = function() { if (typeof app !== 'undefined') app.toggleAnnotations(); };
    this.toggleVisualizationMode = function() { if (typeof app !== 'undefined') app.toggleVisualizationMode();}
};

var gui = new dat.GUI({ width: 400 }); // Made it slightly wider to fit button text
var settingsControls = new SettingsControls();
var settingsFolder = gui.addFolder('Settings & Tools');

// 1. Point Size Slider
settingsFolder.add(settingsControls, 'size').min(0.05).max(1.5).step(0.05).name("Point Size").onChange(function() {
    pointSize = settingsControls.size; // Update global variable
    
    // Update the actual point cloud material immediately if it exists
    if (typeof app !== 'undefined' && app.cur_pointcloud && app.cur_pointcloud.material) {
        app.cur_pointcloud.material.size = pointSize;
        app.cur_pointcloud.material.needsUpdate = true;
    }
});

// 2. Search Radius Slider
settingsFolder.add(settingsControls, 'searchRadius').min(0.1).max(1.0).step(0.1).name(" Tracking search Radius").onChange(function() {
    searchRadius = settingsControls.searchRadius; // Update global variable
});

// 3. Add our two toggles as buttons right under the slider
settingsFolder.add(settingsControls, 'toggleGround').name('Remove/Restore ground');
settingsFolder.add(settingsControls, 'toggleAnnotations').name('Hide/Show labels');
settingsFolder.add(settingsControls, 'toggleVisualizationMode').name('Intensity/Reflectivity view') 

settingsFolder.open();

function toggleRecord() {
    // pause recording
    if (isRecording) {
        $("#record").text("Click here to resume recording");
        app.pause_recording();
        // move2DMode(event);
        isRecording = false;
        controls.enabled = false;
        controls.update();
        
    } else {
        // resume recording
        isRecording = true;
        $("#record").text("Click here to pause recording");
        app.resume_recording();

        controls.enabled = true;
        controls.update();
    }
}

// controller for pressing hotkeys
function onKeyDown2(event) {
    var KeyID = event.keyCode;

    // --- STRICT FOCUS & SCROLL TRAP ---
    if (KeyID >= 37 && KeyID <= 40) {
        var active = document.activeElement;
        // Only allow arrows if you are actively typing in a text box
        if (active && active.tagName === "INPUT" && active.type === "text") {
            // Do nothing, let the user type
        } else {
            event.preventDefault(); // STOP the table/div from scrolling!
            if (active) active.blur(); // Drop focus back to the 3D canvas
        }
    }

    if (isRecording) {
        if (event.ctrlKey) {
            toggleControl(false);
        }
        
        switch(KeyID)
        {
            case 8: // backspace
            deleteSelectedBox();
            break; 
            case 46: // delete
            deleteSelectedBox();
            break;

            case 65: // a key
            autoDrawModeToggle(true);
            break;

            case 90: // z key
            showPreviousFrameBoundingBoxToggle(true);
            break;

            case 68:
            default:
            break;
        }
    }   
}

// controller for releasing hotkeys
function onKeyUp2(event) {
    if(isRecording) {
        var KeyID = event.keyCode;
        switch(KeyID)
        {
            case 65:
            autoDrawModeToggle(false);
            break;
            default:
            toggleControl(true);
            break;
        }
    }
}

function showPreviousFrameBoundingBoxToggle(b) {
    app.show_previous_frame_bounding_box();
}

function autoDrawModeToggle(b) {
    autoDrawMode = b;
}

// toggles between move2D and move3D
function toggleControl(b) {
    if (b) {
        controls.enabled = b;
        controls.update();
    } else {
        // Safely check for move2D regardless of where it was declared
        var isMove2D = (typeof move2D !== 'undefined' && move2D) || (typeof app !== 'undefined' && app.move2D);
        
        if (isMove2D) {
            controls.enabled = b;
            controls.update();
        }
    }
}

function updateMaskRCNNImagePanel() {
    $("#panel").empty();
    $("#panel").prepend('<img src="static/images/masked_image.jpg" />');
    $("#panel").find("img").attr({'src': "static/images/masked_image.jpg?foo=" + new Date().getTime()});
    $("#panel").slideDown( "slow" );
}

function updateCroppedImagePanel(child) {
    $("#panel2").empty();
    if (child == 'outside FOV') {
        $("#panel2").prepend("Bounding box is outside camera's FOV");
    } else {
        $("#panel2").prepend('<img src="static/images/cropped_image.jpg" />');
        $("#panel2").find("img").attr({'src': "static/images/cropped_image.jpg?foo=" + new Date().getTime()});
        $("#panel2").slideDown( "slow" );
    }
}

// controller for pressing hotkeys
function onKeyDown(event) {
    var KeyID = event.keyCode;

    // --- STRICT FOCUS & SCROLL TRAP ---
    if (KeyID >= 37 && KeyID <= 40) {
        var active = document.activeElement;
        // Only allow arrows if you are actively typing in a text box
        if (active && active.tagName === "INPUT" && active.type === "text") {
            // Do nothing, let the user type
        } else {
            event.preventDefault(); // STOP the table/div from scrolling!
            if (active) active.blur(); // Drop focus back to the 3D canvas
        }
    }

    if (isRecording) {
        if (event.ctrlKey) {
            toggleControl(false);
        }
        
        switch(KeyID)
        {
            case 8: // backspace
            deleteSelectedBox();
            break; 
            case 46: // delete
            deleteSelectedBox();
            break;
            case 68:
            default:
            break;
        }
    }   
}

// controller for releasing hotkeys
function onKeyUp(event) {
    if(isRecording) {
        var KeyID = event.keyCode;
        switch(KeyID)
        {
            default:
            toggleControl(true);
            break;
        }
    }
}

function clearTable() {
    for (var i = 0; i < boundingBoxes.length; i++) {
        var box = boundingBoxes[i];
        deleteRow(box.id);
    }
    id = 0;
}
