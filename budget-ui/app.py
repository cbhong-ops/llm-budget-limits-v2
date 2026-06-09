from flask import Flask, request, jsonify, send_from_directory
import google.auth
from google.auth.transport.requests import Request
import requests
import os

app = Flask(__name__, static_url_path='', static_folder='static')

# def get_access_token():
#     try:
#         credentials, project = google.auth.default(
#             scopes=['https://www.googleapis.com/auth/cloud-platform']
#         )
#         credentials.refresh(Request())
#         return credentials.token
#     except Exception as e:
#         print(f"Error getting access token: {e}")
#         return None

def get_access_token():
    try:
        # Cloud Run 환경의 Metadata Server에서 직접 토큰을 가져옵니다.
        url = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token"
        headers = {"Metadata-Flavor": "Google"}
        resp = requests.get(url, headers=headers)
        resp.raise_for_status()
        return resp.json()['access_token']
    except Exception as e:
        print(f"Error getting access token from metadata server: {e}")
        return None


@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/proxies')
def get_proxies():
    org = request.args.get('org')
    if not org:
        return jsonify({"error": "Organization is required"}), 400
    
    token = get_access_token()
    if not token:
        return jsonify({"error": "Failed to authenticate"}), 500
    
    url = f"https://apigee.googleapis.com/v1/organizations/{org}/apis"
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        resp = requests.get(url, headers=headers)
        resp.raise_for_status()
        # Apigee returns a list of objects with 'name' or just a list of names depending on the API version/expansion.
        # Let's assume it returns a list of names or a JSON with 'proxies' array.
        # Usually it returns a JSON like {"proxies": [{"name": "..."}]} or just a list of names.
        # Let's check the response and normalize it.
        data = resp.json()
        if isinstance(data, list):
             return jsonify(data)
        elif 'proxies' in data:
             names = [p['name'] for p in data['proxies']]
             return jsonify(names)
        else:
             # If it's just names in a list inside a field or something.
             return jsonify(data)
    except requests.exceptions.HTTPError as e:
        return jsonify({"error": str(e), "details": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/products')
def get_products():
    org = request.args.get('org')
    if not org:
        return jsonify({"error": "Organization is required"}), 400
    
    token = get_access_token()
    if not token:
        return jsonify({"error": "Failed to authenticate"}), 500
    
    url = f"https://apigee.googleapis.com/v1/organizations/{org}/apiproducts"
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        resp = requests.get(url, headers=headers)
        resp.raise_for_status()
        # Apigee usually returns a list of product names or objects.
        data = resp.json()
        # Normalize to list of names if needed, or return as is.
        # Let's assume it returns a JSON with 'apiProduct' list or similar.
        # Let's just return the data and let the frontend handle it.
        return jsonify(data)
    except requests.exceptions.HTTPError as e:
        return jsonify({"error": str(e), "details": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/products/<name>')
def get_product(name):
    org = request.args.get('org')
    if not org:
        return jsonify({"error": "Organization is required"}), 400
    
    token = get_access_token()
    if not token:
        return jsonify({"error": "Failed to authenticate"}), 500
    
    url = f"https://apigee.googleapis.com/v1/organizations/{org}/apiproducts/{name}"
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        resp = requests.get(url, headers=headers)
        resp.raise_for_status()
        return jsonify(resp.json())
    except requests.exceptions.HTTPError as e:
        return jsonify({"error": str(e), "details": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/products/<name>', methods=['PUT'])
def update_product(name):
    org = request.args.get('org')
    if not org:
        return jsonify({"error": "Organization is required"}), 400
    
    token = get_access_token()
    if not token:
        return jsonify({"error": "Failed to authenticate"}), 500
    
    url = f"https://apigee.googleapis.com/v1/organizations/{org}/apiproducts/{name}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        # Expecting full product payload in request body
        payload = request.json
        
        # Strip read-only fields that cause 400 Bad Request
        read_only_fields = ['createdAt', 'lastModifiedAt', 'organization']
        for field in read_only_fields:
            payload.pop(field, None)
            
        resp = requests.put(url, headers=headers, json=payload)
        resp.raise_for_status()
        return jsonify(resp.json())
    except requests.exceptions.HTTPError as e:
        print(f"Apigee API Error: {resp.text}")
        return jsonify({"error": str(e), "details": resp.text}), resp.status_code
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=True)

