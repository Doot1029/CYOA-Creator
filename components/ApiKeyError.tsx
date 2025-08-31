import React from 'react';

const ApiKeyError: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-gray-800/50 p-8 rounded-lg shadow-lg border border-red-500/50 text-center">
                <h1 className="text-3xl font-bold font-title text-red-300 mb-4">Configuration Error</h1>
                <p className="text-lg text-gray-300 mb-6">
                    The application cannot connect to the Gemini API because the API key is missing.
                </p>
                <div className="bg-gray-900/70 p-6 rounded-lg text-left space-y-4 border border-gray-600">
                    <h2 className="text-xl font-semibold text-purple-300">How to Fix This</h2>
                    <p>To use this application, you need to add your Google Gemini API key as an environment variable in your hosting provider's settings (e.g., Netlify, Vercel).</p>
                    <ol className="list-decimal list-inside space-y-2 text-gray-400">
                        <li>Go to your site's dashboard on your hosting platform.</li>
                        <li>Navigate to the section for "Environment Variables" (often found in "Site Settings" &gt; "Build &amp; Deploy").</li>
                        <li>Create a new variable.</li>
                        <li>Set the <strong className="text-purple-300 bg-gray-700 px-2 py-1 rounded">Key</strong> to: <code className="text-white">API_KEY</code></li>
                        <li>Paste your Gemini API key into the <strong className="text-purple-300">Value</strong> field.</li>
                        <li>Save the variable and redeploy your site. The changes will take effect on the new deployment.</li>
                    </ol>
                </div>
                <p className="mt-6 text-sm text-gray-500">
                    This message is only shown when the API key is not configured. Once you've set it up, your app will load normally.
                </p>
            </div>
        </div>
    );
};

export default ApiKeyError;
