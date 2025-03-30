import React, { useState } from 'react';
import { Container, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import DockerInstallGuide from '../components/DockerInstallGuide';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

const App: React.FC = () => {
  const [dockerVerified, setDockerVerified] = useState(false);

  const handleDockerVerified = () => {
    setDockerVerified(true);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="lg">
        {!dockerVerified ? (
          <DockerInstallGuide onDockerVerified={handleDockerVerified} />
        ) : (
          <div>
            {/* Main application content will go here */}
            <h1>n8n Desktop Wrapper</h1>
            <p>Docker is verified and ready to use!</p>
          </div>
        )}
      </Container>
    </ThemeProvider>
  );
};

export default App; 