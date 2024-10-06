Installation Guide
1. Clone the Repository
https://github.com/HARSH-KAUSHIK261103/Assignment.git 
cd Assignment 
2. Backend Setup
a. Install Python
Ensure Python 3.7+ is installed. Verify with:
python --version
b. Install Dependencies
pip install -r requirements.txt
If requirements.txt is unavailable:
pip install Flask Flask-Cors pymongo python-dotenv
c. Configure Environment Variables
Create a .env file in the backend directory:
MONGO_URI=Your_MongoDG_Atlas_API
d. Run the Backend Server
python app.py
3. Frontend Setup
a. Install Node.js and npm
Download from Node.js. Verify installation:
node --version
npm --version
b. Navigate to Frontend Directory
cd ../frontend
c. Install Dependencies
npm install
# Install additional dependencies:
npm install @mui/material @emotion/react @emotion/styled @mui/icons-material react-icons
d. Run the Frontend Application
npm start
Application accessible at http://localhost:3000/.
