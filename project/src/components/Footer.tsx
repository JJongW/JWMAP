import React from 'react';
import { Instagram, Mail } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white py-8 mt-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-400">
            © {currentYear} <span className="text-white font-medium">밥 먹어야해</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://www.instagram.com/chyubeleub_j/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-orange-500 transition-colors"
            >
              <Instagram className="w-4 h-4" />
            </a>
            <a
              href="mailto:shinjw4675@gmail.com"
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-orange-500 transition-colors"
            >
              <Mail className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
