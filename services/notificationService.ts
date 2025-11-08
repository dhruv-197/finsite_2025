// A placeholder for a notification service, e.g., using react-hot-toast.
// For now, it just logs to the console.

const toast = {
  success: (message: string) => {
    console.log(`SUCCESS: ${message}`);
  },
  error: (message: string) => {
    console.error(`ERROR: ${message}`);
  },
  info: (message: string) => {
    console.log(`INFO: ${message}`);
  },
};

export default toast;
