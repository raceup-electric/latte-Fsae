var options = `<select>
    <option value="SMALL-orange">SMALL-orange</option>
    <option value="SMALL-blue">SMALL-blue</option>
    <option value="SMALL-yellow">SMALL-yellow</option>
    <option value="BIG">BIG</option>
    <option value="UNKNOWN">UNKNOWN</option>
    </select>`;



// method to add row to object id table
function addFrameRow(fname) {
    $("{0} tbody".format(FRAMES_TABLE)).append(
        "<tr><td><div class='fname'>{0}</div></td></tr>".format(fname)
    );
}

// method to add row to object id table
function addObjectRow(box) {
    $("{0} tbody".format(OBJECT_TABLE)).append(
        "<tr><td class='id'><div class='object_row object_row_id'>{0}</td> \
        <td><div class='object_row'>{1}</div></td></tr>".format(box.id, options)
    );
    if (box.object_id) {
        console.log("asssss");
        var row = getRow(box.id);
        console.log(row);
        $(row).find("select").val(box.object_id);
    }
    $("{0} tbody select".format(OBJECT_TABLE)).last().focus();
}

$(FRAMES_TABLE).on("mousedown", "tbody tr", function() {
    var frameId = $(this).find('.fname').text();
    if (!app.frame_lock) {
        app.set_frame(frameId);
        $("{0} tbody tr".format(FRAMES_TABLE)).each(
            function(idx, elem) {
                unfocus_frame_row(elem);
            }
        );
        focus_frame_row($(this));
    }
});

function focus_frame_row(frame) {
    $(frame).find(".fname").attr("selected", true);

}

function unfocus_frame_row(frame) {
    $(frame).find(".fname").attr("selected", false);
}


// $(OBJECT_TABLE).on("mousedown", ".object_row_id", function() {
//     $("{0} tbody tr".format(OBJECT_TABLE)).each(
//         function(idx, elem) {
//             unfocus_object_row(elem);
//             // console.log(idx);
//         }
//     );
//     focus_object_row($(this));
// });

function focus_object_row(frame) {
    $(frame).attr("selected", true);
}

function unfocus_object_row(frame) {
    $(frame).attr("selected", false);
    if ($(frame).find("input").length == 1) {
        var boxId = $(frame).find("input").val();
        $(frame).html(boxId);
        console.log($(frame).html());
    }
}

// handler that highlights input and corresponding bounding box when input is selected
$(OBJECT_TABLE).on('mousedown', '.object_row_id', function(e) {
    if (e.target != this || !isRecording) {return false;}
    // Before selecting the new one, check if there is an existing selectedBox
    // and reset its color to its specific base_color (orange/blue/yellow)
    if (selectedBox) {
        selectedBox.changeBoundingBoxColor(new THREE.Color(selectedBox.base_color));
    }
        
    var is_selected = $(this).attr("selected");
    
    var is_editing = $(this).find("input").length == 1;
    isMoving = false;
    var boxId = $(this).find("input").length == 1 ? $(this).find("input").val() : $(this).text();
    var box = getBoxById(boxId);
    if (box) {
        console.log("boxId: ", boxId);
        $("{0} .object_row_id".format(OBJECT_TABLE)).each(
            function(idx, elem) {
                unfocus_object_row(elem);
            }
        );
        box.select(null);
        
        if (is_selected) {
            // console.log("length: ", $(this).find("input"));
            // console.log(this);
            $(this).html("<input type='text' value='{0}'>".format(boxId));
            console.log("is selected", $(this).html());
            // selectedBox = null;
            app.editing_box_id = true;
        } else {
            selectedBox = box;
            app.editing_box_id = false;
        }
        focus_object_row($(this));
    }
    });


// handler that saves input when input is changed
$("#object-table").on('change', 'tbody tr', updateObjectId);

// handler that is triggered when object table id is right-clicked
// $("#object-table").on('contextmenu', '.id', function() {
//     alert("hi");});


// method to update Box's object id
function updateObjectId() {
    var boxId, input, box;
    console.log("change");
    // console.log($(this).find("input").length);
    if ($(this).find("input").length == 1) {
        boxId = $(this).find("input").val();
        $(this).find(".object_row_id").html(boxId);
        console.log("input", boxId);
    }
    if ($(this).find("input").length == 0) {
        boxId = $(this).find(".id").text();
        console.log("not input", boxId);
    }
    console.log(boxId);
    box = getBoxById(boxId);
    // box = selectedBox;
    // console.log(box, selectedBox);
    if (box) {
        input = $(this).find('select').val();
        console.log(boxId);
        box.object_id = input;
        box.set_box_id(parseInt(boxId))
        
        
        // NOTA: In box.js width e length sembrano invertiti rispetto alla convenzione comune
        // nel codice LATTE spesso 'width' è l'asse X e 'length' è l'asse Z.
        // Se il cono appare ruotato di 90 gradi, scambia i primi due numeri.

        if (input && input.indexOf("SMALL") !== -1) {
            // SMALL: 0.228 x 0.228 x 0.325
            console.log("Ridimensiono a SMALL");
            box.setDimensions(0.228, 0.228, 0.325);
            
        } else if (input && input.indexOf("BIG") !== -1) {
            // BIG: 0.285 x 0.285 x 0.505
            console.log("Ridimensiono a BIG");
            box.setDimensions(0.285, 0.285, 0.505);
        }
        
        // --- COLOR LOGIC (New) ---
        // Define colors (Hex format)
        var colorHex = 0xffffff; // Default White/Unknown

        if (input) {
            if (input.indexOf("blue") !== -1) {
                colorHex = 0x0000ff; // Blue
            } else if (input.indexOf("yellow") !== -1) {
                colorHex = 0xffff00; // Yellow
            } else if (input.indexOf("orange") !== -1 || input.indexOf("BIG") !== -1) {
                colorHex = 0xff7f00; // Orange
            }
        }

        // Apply color to the Box Lines
        box.changeBoundingBoxColor(new THREE.Color(colorHex));
        box.changeBaseColor(colorHex);
        
        // Update internal color state (so it stays this color if you hover/unhover)
        box.color = new THREE.Color(colorHex);
        box.add_timestamp();
    }
    
    app.increment_label_count();
}


// method to get object id table row given id
function getRow(id) {
    var row = $("#object-table tbody").find('td').filter(function() {
        return $(this).text() == id.toString();}).closest("tr");
    return row;
}

// method to select row of object id table given ids
function selectRow(id) {
    var row = getRow(id);    
    $(row).find('select').get(0).focus();
}

function getFrameRow(id) {
    var row = $("{0}".format(FRAMES_TABLE)).find('.fname').filter(function() {
        return $(this).text() == id.toString();}).closest("tr");
    return row;
}

// removes row of object id table given corrensponding bounding box id
function deleteRow(id) {
    var row = getRow(id);
    row.remove();
}

function clearObjectTable() {
    $(OBJECT_TABLE).find('tbody tr').remove();
}

function loadObjectTable() {
    if (app.cur_frame) {
        for (var i = 0; i < app.cur_frame.bounding_boxes.length; i++) {
            var box = app.cur_frame.bounding_boxes[i];

            addObjectRow(box);
        }
    }
}

// gets box given its id
function getBoxById(id) {
    if (!app.cur_frame) return;
    var boundingBoxes = app.cur_frame.bounding_boxes;
    for (var i = 0; i < boundingBoxes.length; i++) {
        if (boundingBoxes[i].id == id) {
            return boundingBoxes[i];
        }
    }
    return null;
}
