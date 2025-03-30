import React, { useState, useEffect } from 'react';
import { Box, Button, Typography, Paper, Stepper, Step, StepLabel, CircularProgress } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  margin: theme.spacing(3),
  maxWidth: 600,
  margin: '0 auto',
}));

interface DockerInstallGuideProps {
  onDockerVerified: () => void;
}

const DockerInstallGuide: React.FC<DockerInstallGuideProps> = ({ onDockerVerified }) => {
  const [isDockerInstalled, setIsDockerInstalled] = useState<boolean | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [isChecking, setIsChecking] = useState(true);

  const steps = [
    'Check Docker Installation',
    'Choose Installation Method',
    'Install Docker',
    'Verify Installation',
  ];

  useEffect(() => {
    checkDockerInstallation();
  }, []);

  const checkDockerInstallation = async () => {
    try {
      // Check if Docker is installed by running 'docker --version'
      const result = await window.electron.invoke('check-docker');
      setIsDockerInstalled(result);
      if (result) {
        onDockerVerified();
      }
    } catch (error) {
      console.error('Error checking Docker installation:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const handleInstallationMethod = (method: 'desktop' | 'cli' | 'manual') => {
    switch (method) {
      case 'desktop':
        window.electron.openExternal('https://www.docker.com/products/docker-desktop');
        break;
      case 'cli':
        // Show CLI installation instructions
        setActiveStep(2);
        break;
      case 'manual':
        // Show manual installation guide
        setActiveStep(2);
        break;
    }
  };

  const handleVerifyInstallation = async () => {
    await checkDockerInstallation();
    if (isDockerInstalled) {
      onDockerVerified();
    }
  };

  if (isChecking) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <StyledPaper elevation={3}>
      <Stepper activeStep={activeStep} alternativeLabel>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Box mt={4}>
        {activeStep === 0 && (
          <>
            <Typography variant="h6" gutterBottom>
              Docker Installation Check
            </Typography>
            <Typography>
              {isDockerInstalled
                ? 'Docker is installed and ready to use!'
                : 'Docker is not installed on your system.'}
            </Typography>
            {!isDockerInstalled && (
              <Button
                variant="contained"
                color="primary"
                onClick={() => setActiveStep(1)}
                sx={{ mt: 2 }}
              >
                Continue to Installation
              </Button>
            )}
          </>
        )}

        {activeStep === 1 && (
          <>
            <Typography variant="h6" gutterBottom>
              Choose Installation Method
            </Typography>
            <Box display="flex" flexDirection="column" gap={2} mt={2}>
              <Button
                variant="outlined"
                onClick={() => handleInstallationMethod('desktop')}
              >
                Install Docker Desktop (Recommended)
              </Button>
              <Button
                variant="outlined"
                onClick={() => handleInstallationMethod('cli')}
              >
                Install Docker CLI
              </Button>
              <Button
                variant="outlined"
                onClick={() => handleInstallationMethod('manual')}
              >
                Install Manually
              </Button>
            </Box>
          </>
        )}

        {activeStep === 2 && (
          <>
            <Typography variant="h6" gutterBottom>
              Installation Instructions
            </Typography>
            <Typography paragraph>
              Follow the installation instructions for your chosen method. Once complete,
              click the button below to verify the installation.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              onClick={handleVerifyInstallation}
            >
              Verify Installation
            </Button>
          </>
        )}
      </Box>
    </StyledPaper>
  );
};

export default DockerInstallGuide; 