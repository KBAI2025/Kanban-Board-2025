#!/bin/bash

# Start MongoDB
osascript -e 'tell app "Terminal" to do script "mongod --dbpath ~/mongodb-data"'

# Start backend
osascript -e 'tell app "Terminal" to do script "cd /Users/utente/Documents/New_Projects_2025/03_Fast_Install_NodeReact/react-starter-kit-main/backend && npm start"'

# Start frontend
osascript -e 'tell app "Terminal" to do script "cd /Users/utente/Documents/New_Projects_2025/03_Fast_Install_NodeReact/react-starter-kit-main && npm start"'