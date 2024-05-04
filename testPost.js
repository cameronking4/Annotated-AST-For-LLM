// const fetch = require('node-fetch');

const code = `import React, { useState } from 'react';
import { AiOutlineHeart, AiOutlineComment } from 'react-icons/ai';

function App() {
  const [likes, setLikes] = useState(0);
  const [comments, setComments] = useState([]);

  const handleLike = () => {
    setLikes(likes + 1);
  };

  const handleComment = (comment) => {
    setComments([...comments, comment]);
  };

  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold">Instagram Clone "Classic"</h2>
      </div>
      <div className="mb-4">
        <div className="flex justify-between">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="w-14 h-14 bg-gray-300 rounded-full"></div>
          ))}
        </div>
      </div>
      <div className="mb-4">
        <div className="w-full h-64 bg-gray-200 p-2">
          <div className="w-12 h-12 bg-black mx-auto"></div>
          <div className="w-6 h-6 bg-black rounded-full mx-auto mt-2"></div>
        </div>
        <div className="flex justify-between items-center mt-2">
          <AiOutlineHeart className="text-2xl cursor-pointer" onClick={handleLike} />
          <AiOutlineComment className="text-2xl cursor-pointer" />
          <span>{likes} likes</span>
        </div>
      </div>
      <div className="mb-4">
        <div className="w-full h-64 bg-gray-200 p-2">
          <div className="w-12 h-12 bg-black mx-auto"></div>
          <div className="w-6 h-6 bg-black rounded-full mx-auto mt-2"></div>
        </div>
        <div className="flex justify-between items-center mt-2">
          <AiOutlineHeart className="text-2xl cursor-pointer" onClick={handleLike} />
          <AiOutlineComment className="text-2xl cursor-pointer" />
          <span>{likes} likes</span>
        </div>
      </div>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Add a comment..."
          className="border p-2 w-full"
          onKeyDown={(e) => e.key === 'Enter' && handleComment(e.target.value)}
        />
        <div className="mt-2">
          {comments.map((comment, index) => (
            <div key={index} className="bg-gray-100 p-2 rounded my-1">{comment}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;`;

async function testPOST() {
  const url = 'http://localhost:5000/create-sandbox';
  const bodyData = {
    code: code
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bodyData)
    });

    const data = await response.json();
    console.log('Response:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}

testPOST();
