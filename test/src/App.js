import React, { useState } from 'react';

const App = () => {
  return (
    <div className="font-sans min-h-screen bg-gray-50 py-8">
      <div className="max-w-xs mx-auto">
        <header className="border-b-2 p-4">
          <h1 className="text-xl font-bold text-center">Instagram Clone "Classic"</h1>
        </header>
        <section aria-label="Stories" className="flex justify-between items-center px-3 py-2">
          <div className="bg-gray-300 w-14 h-14"></div>
          <div className="bg-gray-300 w-14 h-14"></div>
          <div className="bg-gray-300 w-14 h-14"></div>
        </section>
        <section aria-label="Main content" className="px-3 py-2">
          <div className="bg-gray-200 p-16 flex justify-center items-center">
            <span className="block bg-gray-300 w-24 h-24 rounded-full"></span>
          </div>
          <div className="flex justify-around items-center mt-4">
            <span className="block bg-gray-300 w-8 h-8"></span>
            <span className="block bg-gray-300 w-8 h-8"></span>
            <span className="block bg-gray-300 w-8 h-8"></span>
          </div>
        </section>
        <section aria-label="Interactions" className="flex justify-between px-3 py-2">
          <button className="bg-gray-200 px-3 py-1 rounded-full flex items-center">
            <span className="block bg-red-300 w-6 h-6 rounded-full mr-2"></span>
            <span>Comment</span>
          </button>
          <button className="bg-gray-200 px-3 py-1 rounded-full flex items-center">
            <span className="block bg-blue-300 w-6 h-6 rounded-full mr-2"></span>
            <span>Direct</span>
          </button>
        </section>
      </div>
    </div>
  );
};

export default App;
