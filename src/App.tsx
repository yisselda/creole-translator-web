import React, { useState, useRef, useEffect } from 'react';
import { 
  Container, 
  Grid, 
  Paper, 
  Typography, 
  TextField, 
  Button, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel,
  Box,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Card,
  CardContent,
  IconButton,
  Chip
} from '@mui/material';
import { 
  Translate,
  Mic,
  Stop,
  VolumeUp,
  FileCopy,
  Refresh,
  Settings
} from '@mui/icons-material';
import { useCreoleAPI } from './hooks/useCreoleAPI';
import { useWebSocket } from './hooks/useWebSocket';
import { Language, TranslationResult, TranscriptionResult } from './types/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [inputText, setInputText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const [targetLanguage, setTargetLanguage] = useState('ht');
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState<TranscriptionResult | null>(null);
  const [selectedVoice, setSelectedVoice] = useState('default');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const { 
    translateText, 
    transcribeAudio, 
    synthesizeText, 
    languages, 
    voices, 
    isConnected 
  } = useCreoleAPI();

  const { 
    connect: connectWebSocket, 
    disconnect: disconnectWebSocket, 
    sendAudioChunk,
    lastMessage,
    isConnected: wsConnected 
  } = useWebSocket('ws://localhost:8002/api/v1/stream');

  useEffect(() => {
    if (lastMessage) {
      const message = JSON.parse(lastMessage);
      if (message.type === 'final_transcript') {
        setTranscriptionResult({
          text: message.data.text,
          language: message.data.language,
          confidence: message.data.confidence,
          duration: 0
        });
      }
    }
  }, [lastMessage]);

  const handleTranslate = async () => {
    if (!inputText.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await translateText(inputText, sourceLanguage, targetLanguage);
      setTranslatedText(result.translated_text);
    } catch (err) {
      setError('Translation failed. Please try again.');
      console.error('Translation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await transcribeAudio(file, sourceLanguage);
      setTranscriptionResult(result);
      setInputText(result.text);
    } catch (err) {
      setError('Transcription failed. Please try again.');
      console.error('Transcription error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
        // Send real-time audio chunks to WebSocket
        if (wsConnected) {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            sendAudioChunk(base64);
          };
          reader.readAsDataURL(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const file = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });
        
        try {
          const result = await transcribeAudio(file, sourceLanguage);
          setTranscriptionResult(result);
          setInputText(result.text);
        } catch (err) {
          setError('Transcription failed. Please try again.');
          console.error('Transcription error:', err);
        }
      };

      connectWebSocket();
      mediaRecorderRef.current.start(1000); // Send chunks every second
      setIsRecording(true);
    } catch (err) {
      setError('Could not access microphone. Please check permissions.');
      console.error('Recording error:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      disconnectWebSocket();
      setIsRecording(false);
    }
  };

  const handlePlaySpeech = async () => {
    if (!translatedText.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const audioBlob = await synthesizeText(translatedText, targetLanguage, selectedVoice);
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
    } catch (err) {
      setError('Speech synthesis failed. Please try again.');
      console.error('TTS error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const swapLanguages = () => {
    setSourceLanguage(targetLanguage);
    setTargetLanguage(sourceLanguage);
    setInputText(translatedText);
    setTranslatedText(inputText);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h3" component="h1" gutterBottom align="center">
          Creole Translation Platform
        </Typography>
        <Typography variant="h6" color="text.secondary" align="center" sx={{ mb: 2 }}>
          Professional translation, speech-to-text, and text-to-speech services
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
          <Chip 
            label={isConnected ? 'Services Connected' : 'Services Disconnected'} 
            color={isConnected ? 'success' : 'error'}
            variant="outlined"
          />
          <Chip 
            label={`${languages.length} Languages`} 
            color="info"
            variant="outlined"
          />
          <Chip 
            label={`${voices.length} Voices`} 
            color="info"
            variant="outlined"
          />
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper elevation={2}>
        <Tabs 
          value={activeTab} 
          onChange={(_, newValue) => setActiveTab(newValue)}
          centered
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Text Translation" icon={<Translate />} />
          <Tab label="Speech to Text" icon={<Mic />} />
          <Tab label="Text to Speech" icon={<VolumeUp />} />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <FormControl sx={{ minWidth: 120, mr: 2 }}>
                      <InputLabel>From</InputLabel>
                      <Select
                        value={sourceLanguage}
                        onChange={(e) => setSourceLanguage(e.target.value)}
                        label="From"
                      >
                        {languages.map((lang) => (
                          <MenuItem key={lang.code} value={lang.code}>
                            {lang.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <IconButton onClick={swapLanguages} color="primary">
                      <Refresh />
                    </IconButton>
                    <FormControl sx={{ minWidth: 120, ml: 2 }}>
                      <InputLabel>To</InputLabel>
                      <Select
                        value={targetLanguage}
                        onChange={(e) => setTargetLanguage(e.target.value)}
                        label="To"
                      >
                        {languages.map((lang) => (
                          <MenuItem key={lang.code} value={lang.code}>
                            {lang.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                  
                  <TextField
                    fullWidth
                    multiline
                    rows={6}
                    variant="outlined"
                    placeholder="Enter text to translate..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="contained"
                      onClick={handleTranslate}
                      disabled={isLoading || !inputText.trim()}
                      startIcon={isLoading ? <CircularProgress size={20} /> : <Translate />}
                      sx={{ flexGrow: 1 }}
                    >
                      {isLoading ? 'Translating...' : 'Translate'}
                    </Button>
                    <IconButton onClick={() => copyToClipboard(inputText)}>
                      <FileCopy />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Translation Result
                  </Typography>
                  
                  <TextField
                    fullWidth
                    multiline
                    rows={6}
                    variant="outlined"
                    value={translatedText}
                    InputProps={{ readOnly: true }}
                    sx={{ mb: 2 }}
                  />
                  
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="outlined"
                      onClick={handlePlaySpeech}
                      disabled={!translatedText.trim() || isLoading}
                      startIcon={<VolumeUp />}
                      sx={{ flexGrow: 1 }}
                    >
                      Play Audio
                    </Button>
                    <IconButton onClick={() => copyToClipboard(translatedText)}>
                      <FileCopy />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Audio Input
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flex: 1, gap: 2, mb: 3 }}>
                    <Button
                      variant="contained"
                      onClick={isRecording ? stopRecording : startRecording}
                      startIcon={isRecording ? <Stop /> : <Mic />}
                      color={isRecording ? 'error' : 'primary'}
                      sx={{ flexGrow: 1 }}
                    >
                      {isRecording ? 'Stop Recording' : 'Start Recording'}
                    </Button>
                    
                    <input
                      type="file"
                      accept="audio/*"
                      style={{ display: 'none' }}
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                    />
                    <Button
                      variant="outlined"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading}
                    >
                      Upload File
                    </Button>
                  </Box>

                  {isRecording && (
                    <Box sx={{ textAlign: 'center', mb: 2 }}>
                      <CircularProgress />
                      <Typography variant="body2" color="text.secondary">
                        Recording... Speak clearly into your microphone
                      </Typography>
                    </Box>
                  )}

                  {wsConnected && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Real-time transcription active
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Transcription Result
                  </Typography>
                  
                  {transcriptionResult && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body1" sx={{ mb: 1 }}>
                        {transcriptionResult.text}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Chip 
                          label={`${transcriptionResult.language.toUpperCase()}`} 
                          size="small" 
                          color="primary"
                        />
                        <Chip 
                          label={`${Math.round(transcriptionResult.confidence * 100)}% confident`} 
                          size="small" 
                          color="success"
                        />
                      </Box>
                    </Box>
                  )}

                  <Button
                    variant="outlined"
                    onClick={() => transcriptionResult && setInputText(transcriptionResult.text)}
                    disabled={!transcriptionResult}
                    fullWidth
                  >
                    Use for Translation
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Text-to-Speech Settings
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                    <FormControl sx={{ minWidth: 150 }}>
                      <InputLabel>Language</InputLabel>
                      <Select
                        value={targetLanguage}
                        onChange={(e) => setTargetLanguage(e.target.value)}
                        label="Language"
                      >
                        {languages.map((lang) => (
                          <MenuItem key={lang.code} value={lang.code}>
                            {lang.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    
                    <FormControl sx={{ minWidth: 150 }}>
                      <InputLabel>Voice</InputLabel>
                      <Select
                        value={selectedVoice}
                        onChange={(e) => setSelectedVoice(e.target.value)}
                        label="Voice"
                      >
                        {voices
                          .filter(voice => voice.language === targetLanguage)
                          .map((voice) => (
                            <MenuItem key={voice.id} value={voice.id}>
                              {voice.name} ({voice.gender})
                            </MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                  </Box>

                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    variant="outlined"
                    placeholder="Enter text to synthesize..."
                    value={translatedText || inputText}
                    onChange={(e) => setTranslatedText(e.target.value)}
                    sx={{ mb: 2 }}
                  />

                  <Button
                    variant="contained"
                    onClick={handlePlaySpeech}
                    disabled={!(translatedText || inputText).trim() || isLoading}
                    startIcon={isLoading ? <CircularProgress size={20} /> : <VolumeUp />}
                    fullWidth
                  >
                    {isLoading ? 'Generating...' : 'Generate Speech'}
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Paper>
    </Container>
  );
}

export default App;