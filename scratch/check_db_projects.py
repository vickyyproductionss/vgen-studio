import json
import os

db_path = '/Volumes/1TB/WebProjects/VideoGenerator/backend/db.json'
if os.path.exists(db_path):
    with open(db_path, 'r') as f:
        data = json.load(f)
    
    projects = data.get('projects', [])
    print(f"Total projects in db: {len(projects)}")
    for proj in projects:
        state = proj.get('state', {})
        scenes = state.get('scenes', [])
        print(f"Project ID: {proj.get('id')}")
        print(f"Name: {proj.get('name')}")
        print(f"Status: {state.get('status')}")
        print(f"Number of scenes: {len(scenes)}")
        if scenes:
            print(f"First scene sample keys: {list(scenes[0].keys())}")
            print(f"First scene text: {scenes[0].get('text')}")
            words = scenes[0].get('words', [])
            print(f"First scene words count: {len(words)}")
            if words:
                print(f"First 3 words: {words[:3]}")
        print("-" * 40)
else:
    print("db.json not found")
