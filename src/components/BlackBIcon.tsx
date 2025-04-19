import React from 'react';
import './BlackBIcon.css';

interface BlackBIconProps {
  onClose?: () => void;
  label?: string;
}

const BlackBIcon: React.FC<BlackBIconProps> = ({ 
  onClose = () => {}, 
  label = "Black B Icon" 
}) => {
  return (
    <div className="icon-container">
      <div className="icon">
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="100" fill="black" rx="10" ry="10"/>
          <text x="50" y="70" fontFamily="Arial, sans-serif" fontSize="60" fontWeight="bold" textAnchor="middle" fill="white">B</text>
        </svg>
      </div>
      <span className="icon-label">{label}</span>
      <button className="close-button" onClick={onClose}>×</button>
    </div>
  );
};

export default BlackBIcon;
