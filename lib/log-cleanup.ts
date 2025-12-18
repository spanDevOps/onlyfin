import fs from 'fs';
import path from 'path';

/**
 * Clean up old log files, keeping only the latest 3
 */
export function cleanupOldLogs() {
  try {
    const logsDir = path.join(process.cwd(), 'logs');
    
    // Check if logs directory exists
    if (!fs.existsSync(logsDir)) {
      return;
    }
    
    // Get all log files
    const files = fs.readdirSync(logsDir)
      .filter(file => file.startsWith('app-') && file.endsWith('.log'))
      .map(file => ({
        name: file,
        path: path.join(logsDir, file),
        mtime: fs.statSync(path.join(logsDir, file)).mtime.getTime()
      }))
      .sort((a, b) => b.mtime - a.mtime); // Sort by modification time, newest first
    
    // Keep only the latest 3, delete the rest
    if (files.length > 3) {
      const filesToDelete = files.slice(3);
      filesToDelete.forEach(file => {
        try {
          fs.unlinkSync(file.path);
          console.log(`[LOG_CLEANUP] Deleted old log: ${file.name}`);
        } catch (error) {
          console.error(`[LOG_CLEANUP] Failed to delete ${file.name}:`, error);
        }
      });
    }
  } catch (error) {
    console.error('[LOG_CLEANUP] Error during log cleanup:', error);
  }
}
