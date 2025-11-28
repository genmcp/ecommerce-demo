import React from 'react';
import styles from './SafetyBanner.module.css';

interface SafetyBannerProps {
  status: 'normal' | 'danger';
  message?: string;
}

const SafetyBanner: React.FC<SafetyBannerProps> = ({ status, message }) => {
  return (
    <div className={`${styles.banner} ${status === 'danger' ? styles.danger : ''}`}>
      <div className={styles.content}>
        <div className={styles.indicator} />
        <span className={styles.statusText}>
          {status === 'normal' ? 'System Normal' : 'Security Alert'}
        </span>
        {message && <span>| {message}</span>}
      </div>
      <div className={styles.content}>
        <span>GenMCP Safety Monitor</span>
      </div>
    </div>
  );
};

export default SafetyBanner;
