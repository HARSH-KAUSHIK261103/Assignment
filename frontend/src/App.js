// src/App.js

import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { FaTimes, FaEdit } from 'react-icons/fa'; // Additional icons
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
} from '@mui/material';
import { styled } from '@mui/system';

const VideoContainer = styled('div')({
  position: 'relative',
  display: 'inline-block',
  marginTop: '20px',
  width: '100%', // Make container take full width
  maxWidth: '1200px',
});

const Overlay = styled('div')(({ top, left, width, height }) => ({
  position: 'absolute',
  top: `${top}px`,
  left: `${left}px`,
  width: `${width}px`,
  height: `${height}px`,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  color: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '4px',
  pointerEvents: 'none',
}));

const OverlayIcon = styled(FaTimes)({
  marginLeft: '10px',
  cursor: 'pointer',
  color: 'red',
  pointerEvents: 'auto',
});

const EditIcon = styled(FaEdit)({
  marginLeft: '10px',
  cursor: 'pointer',
  color: 'yellow',
  pointerEvents: 'auto',
});

const App = () => {
  const [rtspUrl, setRtspUrl] = useState('');
  const [streamStarted, setStreamStarted] = useState(false);
  const [streamId, setStreamId] = useState(null);
  const [overlays, setOverlays] = useState([]);
  const [overlayText, setOverlayText] = useState('');
  const [overlayPosition, setOverlayPosition] = useState({ top: 50, left: 50 });
  const [overlaySize, setOverlaySize] = useState({ width: 200, height: 100 });
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [currentOverlay, setCurrentOverlay] = useState(null);
  const videoRef = useRef(null);

  // Fetch overlays when streamId changes
  useEffect(() => {
    const fetchOverlays = async () => {
      if (!streamId) return;
      try {
        const response = await fetch(`http://localhost:5000/overlays/${streamId}`);
        if (response.ok) {
          const data = await response.json();
          setOverlays(data);
        } else {
          const errorData = await response.json();
          console.error('Failed to fetch overlays:', errorData.error);
        }
      } catch (error) {
        console.error('Error fetching overlays:', error);
      }
    };

    fetchOverlays();
  }, [streamId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rtspUrl) {
      alert('Please enter a valid RTSP URL.');
      return;
    }

    // Clear previous overlays when starting a new stream
    setOverlays([]);
    setStreamId(null);
    setStreamStarted(false);

    // Send RTSP URL to the backend
    try {
      const response = await fetch('http://localhost:5000/start-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rtsp_url: rtspUrl }),
      });

      if (response.ok) {
        const data = await response.json();
        setStreamId(data.stream_id); // Set the new stream ID
        setStreamStarted(true);
      } else {
        const errorData = await response.json();
        console.error('Failed to start stream:', errorData.error);
        alert(`Failed to start stream: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error starting stream:', error);
      alert('An error occurred while starting the stream.');
    }
  };

  // Play the HLS stream
  useEffect(() => {
    if (streamStarted && streamId) {
      if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(`http://localhost:5000/hls/${streamId}.m3u8`);
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS.js error:', data);
        });
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = `http://localhost:5000/hls/${streamId}.m3u8`;
      } else {
        console.error('HLS is not supported in this browser.');
      }
    }
  }, [streamStarted, streamId]);

  // Create a new overlay
  const createOverlay = async () => {
    if (!streamId) {
      alert('Please start a stream first.');
      return;
    }

    // Validate overlay inputs
    if (
      !overlayText ||
      isNaN(overlayPosition.top) ||
      isNaN(overlayPosition.left) ||
      isNaN(overlaySize.width) ||
      isNaN(overlaySize.height)
    ) {
      alert('Please provide valid overlay details.');
      return;
    }

    const newOverlay = {
      stream_id: streamId,
      text: overlayText,
      position: {
        top: parseInt(overlayPosition.top, 10),
        left: parseInt(overlayPosition.left, 10),
      },
      size: {
        width: parseInt(overlaySize.width, 10),
        height: parseInt(overlaySize.height, 10),
      },
    };

    try {
      const response = await fetch('http://localhost:5000/overlays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOverlay),
      });

      const result = await response.json();
      if (response.ok) {
        setOverlays([...overlays, { ...newOverlay, _id: result.overlay_id, visible: true }]);
        setOverlayText(''); // Clear input after adding overlay
        setOverlayPosition({ top: 50, left: 50 }); // Reset to default positions
        setOverlaySize({ width: 200, height: 100 }); // Reset to default sizes
      } else {
        console.error('Failed to create overlay:', result.error);
        alert(`Failed to create overlay: ${result.error}`);
      }
    } catch (error) {
      console.error('Error creating overlay:', error);
      alert('An error occurred while creating the overlay.');
    }
  };

  // Delete an overlay
  const deleteOverlay = async (overlayId) => {
    try {
      const response = await fetch(`http://localhost:5000/overlays/${overlayId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setOverlays((prevOverlays) => prevOverlays.filter((overlay) => overlay._id !== overlayId));
      } else {
        const errorData = await response.json();
        console.error('Failed to delete overlay:', errorData.error);
        alert(`Failed to delete overlay: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error deleting overlay:', error);
      alert('An error occurred while deleting the overlay.');
    }
  };

  // Open the edit dialog
  const handleEditOverlay = (overlay) => {
    setCurrentOverlay(overlay);
    setOpenEditDialog(true);
  };

  // Handle updating an overlay
  const handleUpdateOverlay = async () => {
    if (!currentOverlay) return;

    // Validate overlay inputs
    if (
      !currentOverlay.text ||
      isNaN(currentOverlay.position.top) ||
      isNaN(currentOverlay.position.left) ||
      isNaN(currentOverlay.size.width) ||
      isNaN(currentOverlay.size.height)
    ) {
      alert('Please provide valid overlay details.');
      return;
    }

    const updatedFields = {
      text: currentOverlay.text,
      position: {
        top: parseInt(currentOverlay.position.top, 10),
        left: parseInt(currentOverlay.position.left, 10),
      },
      size: {
        width: parseInt(currentOverlay.size.width, 10),
        height: parseInt(currentOverlay.size.height, 10),
      },
    };

    try {
      const response = await fetch(`http://localhost:5000/overlays/${currentOverlay._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields),
      });

      if (response.ok) {
        setOverlays((prevOverlays) =>
          prevOverlays.map((overlay) =>
            overlay._id === currentOverlay._id ? { ...overlay, ...updatedFields } : overlay
          )
        );
        setOpenEditDialog(false);
        setCurrentOverlay(null);
      } else {
        const errorData = await response.json();
        console.error('Failed to update overlay:', errorData.error);
        alert(`Failed to update overlay: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error updating overlay:', error);
      alert('An error occurred while updating the overlay.');
    }
  };

  // Toggle overlay visibility
  const toggleOverlayVisibility = async (overlay) => {
    const updatedFields = { visible: !overlay.visible };
    try {
      const response = await fetch(`http://localhost:5000/overlays/${overlay._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields),
      });

      if (response.ok) {
        setOverlays((prevOverlays) =>
          prevOverlays.map((o) =>
            o._id === overlay._id ? { ...o, visible: updatedFields.visible } : o
          )
        );
      } else {
        const errorData = await response.json();
        console.error('Failed to toggle overlay visibility:', errorData.error);
        alert(`Failed to toggle overlay visibility: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error toggling overlay visibility:', error);
      alert('An error occurred while toggling the overlay visibility.');
    }
  };

  return (
    <div>
      {/* AppBar for a modern header */}
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6">RTSP to HLS Stream with Overlays</Typography>
        </Toolbar>
      </AppBar>

      <Container>
        {/* Stream Form */}
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 4 }}>
          <Grid container spacing={2} alignItems="center" justifyContent="center">
            <Grid item xs={12} sm={8}>
              <TextField
                label="Enter RTSP URL"
                variant="outlined"
                fullWidth
                value={rtspUrl}
                onChange={(e) => setRtspUrl(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Button type="submit" variant="contained" color="primary" fullWidth>
                Start Stream
              </Button>
            </Grid>
          </Grid>
        </Box>

        {/* Video and Overlays */}
        {streamStarted && streamId && (
          <VideoContainer>
            <Typography variant="h6" gutterBottom>
              Live Stream:
            </Typography>
            <video ref={videoRef} controls autoPlay style={{ width: '100%', maxWidth: '800px' }}>
              Your browser does not support the video tag.
            </video>

            {/* Overlay elements */}
            {overlays.map((overlay) =>
              overlay.visible ? (
                <Overlay
                  key={overlay._id}
                  top={overlay.position.top}
                  left={overlay.position.left}
                  width={overlay.size.width}
                  height={overlay.size.height}
                >
                  {overlay.text}
                  <OverlayIcon onClick={() => deleteOverlay(overlay._id)} />
                  <EditIcon onClick={() => handleEditOverlay(overlay)} />
                </Overlay>
              ) : null
            )}
          </VideoContainer>
        )}

        {/* Overlay Creation Form */}
        {streamStarted && (
          <Card sx={{ mt: 4 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Create New Overlay
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Overlay Text"
                    variant="outlined"
                    fullWidth
                    value={overlayText}
                    onChange={(e) => setOverlayText(e.target.value)}
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField
                    label="Top Position (px)"
                    variant="outlined"
                    type="number"
                    fullWidth
                    value={overlayPosition.top}
                    onChange={(e) =>
                      setOverlayPosition({ ...overlayPosition, top: e.target.value })
                    }
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField
                    label="Left Position (px)"
                    variant="outlined"
                    type="number"
                    fullWidth
                    value={overlayPosition.left}
                    onChange={(e) =>
                      setOverlayPosition({ ...overlayPosition, left: e.target.value })
                    }
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField
                    label="Width (px)"
                    variant="outlined"
                    type="number"
                    fullWidth
                    value={overlaySize.width}
                    onChange={(e) =>
                      setOverlaySize({ ...overlaySize, width: e.target.value })
                    }
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField
                    label="Height (px)"
                    variant="outlined"
                    type="number"
                    fullWidth
                    value={overlaySize.height}
                    onChange={(e) =>
                      setOverlaySize({ ...overlaySize, height: e.target.value })
                    }
                  />
                </Grid>
              </Grid>
            </CardContent>
            <CardActions>
              <Button variant="contained" color="secondary" onClick={createOverlay}>
                Add Overlay
              </Button>
            </CardActions>
          </Card>
        )}

        {/* Manage Overlays */}
        {streamStarted && streamId && (
          <Card sx={{ mt: 4 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Manage Overlays
              </Typography>
              {overlays.length > 0 ? (
                overlays.map((overlay) => (
                  <Card key={overlay._id} sx={{ mb: 2 }}>
                    <CardContent>
                      <Typography>
                        <strong>Text:</strong> {overlay.text}
                      </Typography>
                      <Typography>
                        <strong>Position:</strong> Top: {overlay.position.top}px, Left: {overlay.position.left}px
                      </Typography>
                      <Typography>
                        <strong>Size:</strong> Width: {overlay.size.width}px, Height: {overlay.size.height}px
                      </Typography>
                      <Typography>
                        <strong>Visible:</strong> {overlay.visible ? 'Yes' : 'No'}
                      </Typography>
                    </CardContent>
                    <CardActions>
                      <Button
                        size="small"
                        color="primary"
                        onClick={() => toggleOverlayVisibility(overlay)}
                      >
                        {overlay.visible ? 'Hide' : 'Show'}
                      </Button>
                      <Button
                        size="small"
                        color="primary"
                        onClick={() => handleEditOverlay(overlay)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => deleteOverlay(overlay._id)}
                      >
                        Delete
                      </Button>
                    </CardActions>
                  </Card>
                ))
              ) : (
                <Typography>No overlays available.</Typography>
              )}
            </CardContent>
          </Card>
        )}

        {/* Edit Overlay Dialog */}
        <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)}>
          <DialogTitle>Edit Overlay</DialogTitle>
          <DialogContent>
            {currentOverlay && (
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    label="Overlay Text"
                    variant="outlined"
                    fullWidth
                    value={currentOverlay.text}
                    onChange={(e) =>
                      setCurrentOverlay({ ...currentOverlay, text: e.target.value })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Top Position (px)"
                    variant="outlined"
                    type="number"
                    fullWidth
                    value={currentOverlay.position.top}
                    onChange={(e) =>
                      setCurrentOverlay({
                        ...currentOverlay,
                        position: { ...currentOverlay.position, top: e.target.value },
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Left Position (px)"
                    variant="outlined"
                    type="number"
                    fullWidth
                    value={currentOverlay.position.left}
                    onChange={(e) =>
                      setCurrentOverlay({
                        ...currentOverlay,
                        position: { ...currentOverlay.position, left: e.target.value },
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Width (px)"
                    variant="outlined"
                    type="number"
                    fullWidth
                    value={currentOverlay.size.width}
                    onChange={(e) =>
                      setCurrentOverlay({
                        ...currentOverlay,
                        size: { ...currentOverlay.size, width: e.target.value },
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Height (px)"
                    variant="outlined"
                    type="number"
                    fullWidth
                    value={currentOverlay.size.height}
                    onChange={(e) =>
                      setCurrentOverlay({
                        ...currentOverlay,
                        size: { ...currentOverlay.size, height: e.target.value },
                      })
                    }
                  />
                </Grid>
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenEditDialog(false)}>Cancel</Button>
            <Button variant="contained" color="primary" onClick={handleUpdateOverlay}>
              Save
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </div>
  );
};

export default App;
