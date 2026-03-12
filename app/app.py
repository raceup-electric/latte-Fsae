from flask import Flask, render_template, request, jsonify
from models import BoundingBox
from pointcloud import PointCloud
from frame_handler import FrameHandler
from bounding_box_predictor import BoundingBoxPredictor
import numpy as np
import json
import os
from pathlib import Path

app = Flask(__name__, static_url_path='/static')
DIR_PATH = os.path.dirname(os.path.realpath(__file__))
frame_cluster_cache = {}

@app.route("/")
def root():
    return render_template("index.html")
    

@app.route('/getFrameClustersData', methods=['POST'])
def get_frame_clusters_data():
    json_request = request.get_json()
    fname = json_request["fname"]
    drivename, fname = fname.split("/")

    frame = fh.get_pointcloud(drivename, fname, dtype=float, ground_removed=True)
    
    # Get the dictionary mapping { cluster_idx: array_of_points }
    cluster_dict = bp.extract_frame_clusters(frame)
    
    frame_cluster_cache[fname] = cluster_dict
    
    # Prepare the lightweight math metadata for the JS Frontend
    metadata_response = []
    
    for cluster_idx, cluster_points in cluster_dict.items():
        w = np.max(cluster_points[:, 0]) - np.min(cluster_points[:, 0])
        l = np.max(cluster_points[:, 1]) - np.min(cluster_points[:, 1])
        
        metadata_response.append({
            "idx": cluster_idx,
            "x": float(np.mean(cluster_points[:, 0])),
            "y": float(np.mean(cluster_points[:, 1])),
            "w": float(w),
            "l": float(l)
        })
        
    return jsonify(metadata_response)

@app.route("/initTracker", methods=["POST"])
def init_tracker():
    json_request = request.get_json()
    pointcloud = PointCloud.parse_json(json_request["pointcloud"])
    tracker = Tracker(pointcloud)
    return "success"

@app.route("/trackBoundingBoxes", methods=['POST'])
def trackBoundingBox():
    json_request = request.get_json()
    pointcloud = PointCloud.parse_json(json_request["pointcloud"], json_request["intensities"])
    filtered_indices = tracker.filter_pointcloud(pointcloud)
    next_bounding_boxes = tracker.predict_bounding_boxes(pointcloud)
    return str([filtered_indices, next_bounding_boxes])

@app.route("/updateBoundingBoxes", methods=['POST'])
def updateBoundingBoxes():
    json_request = request.get_json()
    bounding_boxes = BoundingBox.parse_json(json_request["bounding_boxes"])
    tracker.set_bounding_boxes(bounding_boxes)
    return str(bounding_boxes)

@app.route("/writeOutput", methods=['POST'])
def writeOutput():
    frame = request.get_json()['output']
    fname = frame['filename']
    drivename, fname = fname.split('/')
    fh.save_annotation(drivename, fname, frame["file"])
    return str("hi")

@app.route("/loadFrameNames", methods=['POST'])
def loadFrameNames():
    return fh.get_frame_names()

@app.route("/getFramePointCloud", methods=['POST'])
def getFramePointCloud():
    json_request = request.get_json()
    fname = json_request["fname"]
    # Leggiamo il flag inviato dal bottone (Default: False = vedi tutto)
    ground_removed = json_request.get("ground_removed", False) 
    
    drivename, fname = fname.split("/")
    # Passiamo il flag al FrameHandler
    data_str = fh.get_pointcloud(drivename, fname, dtype=str, ground_removed=ground_removed)
    annotation_str = str(fh.load_annotation(drivename, fname, dtype='json'))
    return '?'.join([data_str, annotation_str])

@app.route("/getJustPointCloud", methods=['POST'])
def getJustPointCloud():
    """Rotta super-veloce che scarica solo i punti senza toccare le annotazioni JSON"""
    json_request = request.get_json()
    fname = json_request["fname"]
    ground_removed = json_request.get("ground_removed", False)
    
    drivename, fname = fname.split("/")
    data_str = fh.get_pointcloud(drivename, fname, dtype=str, ground_removed=ground_removed)
    return data_str
    


@app.route("/predictBoundingBox", methods=['POST'])
def predictBoundingBox():
    json_request = request.get_json()
    fname = json_request["fname"]
    drivename, fname = fname.split("/")
    point = json_request["point"]
    point = np.array([point['z'], point['x'], point['y']])

    frame = fh.get_pointcloud(drivename, fname, dtype=float, ground_removed=True)
    return str(bp.predict_bounding_box(point, frame))

@app.route("/predictNextFrameBoundingBoxes", methods=['POST'])
def predictNextFrameBoundingBoxes():
    json_request = request.get_json()
    fname = json_request["fname"]
    drivename, fname = fname.split("/")
    frame = fh.load_annotation(drivename, fname)
    res = bp.predict_next_frame_bounding_boxes(frame)
    keys = list(res.keys())
    for key in keys:
        res[str(key)] = res.pop(key)

    return str(res)

@app.route("/loadAnnotation", methods=['POST'])
def loadAnnotation():
    json_request = request.get_json()
    fname = json_request["fname"]
    frame = fh.load_annotation(fname)
   
    
    return str(frame.bounding_boxes)

if __name__ == "__main__":
    fh = FrameHandler()
    bp = BoundingBoxPredictor(fh)
    # Rimossa la pulizia inutile della cartella immagini
    app.run()
