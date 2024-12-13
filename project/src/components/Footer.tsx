import React from 'react';
import { Globe, Mail } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-green-500 text-white py-6">
      <div className="container mx-auto flex flex-col items-center justify-center space-y-4">
        <div className="text-lg font-semibold">© 2024 JW Map Project</div>
        <div className="flex space-x-6">
          <a
            href="https://www.instagram.com/chyubeleub_j/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 hover:text-pink-500 transition-colors"
          >
            <Globe className="w-5 h-5" />
            <span>Instagram</span>
          </a>
          <a
            href="mailto:shinjw4675@gmail.com"
            className="flex items-center space-x-2 hover:text-blue-400 transition-colors"
          >
            <Mail className="w-5 h-5" />
            <span>Email</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
