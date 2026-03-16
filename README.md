# LATTE-Fsae: 3D LiDAR Annotation Tool (Formula Student Edition)

LATTE-Fsae is a highly customized fork of the [original LATTE annotation tool](https://github.com/bernwang/latte), tailored and optimized specifically for **Formula Student Driverless (FSAE)** applications. It streamlines the process of annotating 3D LiDAR point clouds to train perception models for track limits (cones).
## Key Features & Upgrades

* **Intensity-Based Visualization:** Replaced the default height-based colormap with a high-contrast Jet Colormap based on LiDAR intensity
* **Adaptive Ground Removal Toggle:** A dedicated UI button to instantly hide/show the ground plane without losing annotations or reloading the page
* **FSAE Official Labels:** Bounding boxes and labels are mapped to the official Formula Student rules (e.g., Blue Cone, Yellow Cone, Orange Cone, Big Orange Cone).
* **Simple Tracking:** uses Open3D DBSCAN clustering to perfectly "snap" bounding boxes to the cones in the next frame, compensating for car movement and drastically reducing manual labeling time.
* **Label-cluster association:** Checks wheter a bounding box can be associated (position & dimension) to a cluster on that frame
* Overall **usability upgrade and visual assistance**.
##  Installation 

1. Clone the repository:

2. Create a virtual environment inside the project folder and install dependencies:
```bash
virtualenv env
source env/bin/activate
pip3 install -r requirements.txt
```

3. Run the Flask server:
```bash
python app/app.py
```

4. Open your browser and navigate to `http://127.0.0.1:5000`

##  Dataset Folder Structure

For LATTE-Fsae to correctly load the point clouds, *ground-removed* clouds, and *odometry*, your data must be placed inside the `test_dataset/`folder strictly following this hierarchy:

```text
app
└──test_dataset/
    └── 01_dataset_sync/      <-- must have "sync" at the end
		├── bin_data/
		│   ├── 000000.bin
		│   └── 000001.bin
		├── ground_removed/   <-- Ground removed Point Clouds
		│   ├── 000000.bin
		│   └── 000001.bin
		├── oxts/             <-- Odometry data for tracking (can be dummies)
		│   ├── 000000.txt
		│   └── 000001.txt
		└── image/            <-- Dummy or real camera images (.png)
	    	├── 000000.png
	    	└── 000001.png
```
*Note: Point cloud `.bin` files must be `float32` arrays containing `[x, y, z, intensity]`.*

## Usage & Controls

### The Control Panel (Top Right)
Use the integrated control panel to adjust the visualizer:
* **Point Size slider:** Adjusts the thickness of the LiDAR points in real-time
* **Tracking Search Radius slider:** Adjusts the search_radius used to crop the search area in the Tracking function
* **Remove/Restore ground:** Swaps between the `bin_data` and `ground_removed` clouds instantly
* **Hide/Show labels** 

### Actions
* **One-click bounding box draw:** Hold the `a` key, then click a point in the cluster and the tool will draw a bounding box
* **Drawing bounding box:** Bounding boxes can be drawn by holding the `ctrl` key and clicking and dragging
* **Translation:** Hold `ctrl` then click&drag a box (the color of the box changes to light blue)
* **Rotation:** Hold `ctrl` then click&drag the box's red high-mid point
* **Resizing:** Hold `ctrl` then click&drag a box's red corner
* **Deletion:** Press the `canc` key while the box is selected in the boxes list

>[!WARNING] 
>* Bounding boxes anchor points (red dots) stay always at 0 height, actions on bounding boxes have to be performed at 0 height accordingly (e.g: for translation of a box click & draw from the red dots center, whatever height the bounding lines have)

### UI utilities
* **Colored labels:** The color of the object's ID label indicated whether the bounding box is associated to a cluster or not (white if associated, red if not)
* **Auto adjusting height** based on associated clusters

