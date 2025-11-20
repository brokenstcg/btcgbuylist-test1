# **Broken TCG Web App**

This is a React application powered by Vite, Tailwind CSS, and Firebase.

## **1\. Setup**

1. **Install Node.js**: Download and install from https://nodejs.org/  
2. **Create Folder**: Create a new folder on your desktop named broken-tcg.  
3. **Create Files**: Create the files listed above (package.json, vite.config.js, etc.) inside this folder. Ensure the folder structure matches (e.g., src/App.jsx).  
4. **Install Dependencies**: Open your terminal/command prompt, navigate to this folder, and run:  
   npm install

## **2\. Firebase Configuration**

1. Go to [console.firebase.google.com](https://console.firebase.google.com/) and create a new project.  
2. Enable **Authentication** (Anonymous and/or Email/Password).  
3. Enable **Firestore Database** (Start in Test Mode for development, then switch to Production rules).  
4. Copy your web app configuration keys.  
5. Open src/firebase.js and replace the placeholder values with your actual keys.

## **3\. Gemini API Key**

1. Get an API key from Google AI Studio.  
2. Create a file named .env in the root folder.  
3. Add this line:  
   VITE\_GEMINI\_API\_KEY=your\_actual\_api\_key\_here

## **4\. Run Locally**

To start the app on your computer:

npm run dev

Open the local URL provided (usually http://localhost:5173).

## **5\. Deploy**

To publish to the web (e.g., using Vercel or Netlify):

1. Push this code to a GitHub repository.  
2. Connect your repository to Vercel/Netlify.  
3. Add your environment variables (VITE\_GEMINI\_API\_KEY) in the hosting dashboard settings.  
4. Deploy\!