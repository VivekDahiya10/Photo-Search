import requests
import os
from dotenv import load_dotenv

load_dotenv()

voyage_api_key = os.getenv('VOYAGE_API_KEY')
VOYAGE_API_URL = "https://api.voyageai.com/v1/multimodalembeddings"

def test_voyage_text():
    headers = {
        "Authorization": f"Bearer {voyage_api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "inputs": [
            {
                "content": [
                    {
                        "type": "text",
                        "text": "This is a test message"
                    }
                ]
            }
        ],
        "model": "voyage-multimodal-3",
        "input_type": "query"
    }
    
    try:
        response = requests.post(VOYAGE_API_URL, headers=headers, json=payload, verify=False)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            embedding = result["data"][0]["embedding"]
            print(f"Success! Embedding length: {len(embedding)}")
            return True
        else:
            print("Failed!")
            return False
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    print("Testing Voyage AI API...")
    test_voyage_text()
