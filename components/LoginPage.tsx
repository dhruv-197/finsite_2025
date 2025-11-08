
import React, { useState } from 'react';
import { User } from '../types';
import { USERS } from '../constants';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [selectedUserId, setSelectedUserId] = useState<string>(USERS[0].id.toString());

  const handleLogin = () => {
    const user = USERS.find(u => u.id.toString() === selectedUserId);
    if (user) {
      onLogin(user);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">Login</h1>
        <div className="mb-4">
          <label htmlFor="user-select" className="block text-sm font-medium text-gray-700 mb-2">
            Select a user profile to proceed:
          </label>
          <select
            id="user-select"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {USERS.map(user => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.role})
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Login
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
