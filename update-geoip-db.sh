#!/bin/bash
if [ -f .env ]; then
    # shellcheck disable=SC1091
    . .env
    export GEODATADIR
    export MAXMIND_API_KEY
fi

if [ -z "$MAXMIND_API_KEY" ] || [ -z "$GEODATADIR" ]; then
    echo "Error: Both MAXMIND_API_KEY and GEODATADIR environment variables must be set."
    exit 1
fi
export LICENSE_KEY=$MAXMIND_API_KEY

node ./node_modules/geoip-lite/scripts/updatedb.js
