import requests

def get_okta_token(secrets, url=''):
    
    
    body = {"client_id": secrets["OKTA_CLIENT_ID"],
			"username": secrets["CURRENT_OKTA_USERNAME"],
			"password": secrets["CURRENT_OKTA_PASSWORD"],
			"client_secret": secrets["OKTA_CLIENT_SECRET"],
			"grant_type": "password",
			"scope": "openid profile"}
    headers = {'Content-Type': 'application/x-www-form-urlencoded'}
    

    r = requests.post(url, data=(body), headers=headers)
    if r.status_code != 200:
        raise Exception(f'Error getting token, response status: "{r.status_code}: {r.text}"')

    token = r.json()['token_type'] +' '+ r.json()['access_token']
    #print(token)
    return token