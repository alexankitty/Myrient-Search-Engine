# Myrient Search Engine
It is finally here. There is now a way to search all of Myrient's offerings.
[Myrient Search](https://myrient.mahou.one) can be accessed by clicking the link.
# Resource Requirements
- 1.5GB-ish of memory for the initial crawl (can be reduced by tweaking environment variables at the cost of slower indexing)
- 800MB-ish of memory for running the server
- HTTPS for some CORS functions to work correctly.

# Self-Hosting

## Docker Method (Recommended)
### Requirements
- Docker / Docker Compose

### Instructions
1. Download the `docker-compose.yml` file
2. Start the server with `docker-compose up -d`

## Manual Method (Development)
### Requirements
- nodejs
- npm
- PostgreSQL
- Elasticsearch
- Docker (optional)

### Instructions
1. Clone the repository. `git clone https://github.com/alexankitty/Myrient-Search-Engine`
2. Install dependencies. `npm i`
3. Run your PostgreSQL and Elasticsearch instances. A docker compose file is provided in the repository for convenience.
4. Start the server. `node server.js`

# HTTPS Encryption
Use something like `nginx` and add a site to sites-available called myrient-search in `/etc/nginx/sites-available`.
Link the site to the sites-enabled folder. `ln -sf /etc/nginx/sites-available/myrient-search /etc/nginx/sites-enabled/myrient-search`
## nginx Site Template
```
server {
    listen 80;
    listen [::]:80;

    server_name server address.tld
    root /usr/share/nginx
    access_log on;
}

#server {

    listen 443 ssl http2;
    listen [::]:443 ssl http2;

    server_name serveraddress.tld;
    access_log on;

    root /usr/share/nginx;

    location / {
        add_header Cache-Control no-cache;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Host $http_host;
        proxy_pass http://127.0.0.1:8062/;
    }

}
```
## SSL Certificate
For the SSL certificate you can use certbot via the `certbot -d servername.tld` command and adding it to your `crontab`.
[Additional Information for Certbot Setup](https://www.digitalocean.com/community/tutorials/how-to-secure-nginx-with-let-s-encrypt-on-ubuntu-20-04)

# Contributing
You know the usual fluff.  
Is there a missing category or string association? `lib/categories.json` and any of the files under `lib/json/relatedkeywords` can both updated to include these. If you do update/improve these, please put in a pull request so that it can be added to the public hosted server, as well.  
Pull requests are always welcome. Make sure to make any changes clear in your pull request, and if possible, run any files you've modified through prettier.