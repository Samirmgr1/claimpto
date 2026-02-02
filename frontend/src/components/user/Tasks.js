import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import Navbar from '../common/Navbar';
import BottomNav from '../common/BottomNav';
import SuccessPopup from '../common/SuccessPopup';
import Turnstile, { useTurnstile } from '../common/Turnstile';
import { useAuth, useSettings, useData } from '../../context/AuthContext';

// Math Puzzle Generator
const generateMathPuzzle = () => {
  const operations = ['+', '-', '×'];
  const operation = operations[Math.floor(Math.random() * operations.length)];
  let num1, num2, answer;
  
  switch (operation) {
    case '+':
      num1 = Math.floor(Math.random() * 50) + 1;
      num2 = Math.floor(Math.random() * 50) + 1;
      answer = num1 + num2;
      break;
    case '-':
      num1 = Math.floor(Math.random() * 50) + 20;
      num2 = Math.floor(Math.random() * num1) + 1;
      answer = num1 - num2;
      break;
    case '×':
      num1 = Math.floor(Math.random() * 12) + 1;
      num2 = Math.floor(Math.random() * 12) + 1;
      answer = num1 * num2;
      break;
    default:
      num1 = 5;
      num2 = 5;
      answer = 10;
  }
  
  return {
    question: `${num1} ${operation} ${num2}`,
    answer: answer.toString(),
    num1,
    num2,
    operation
  };
};

// Premium SVG Icons for task types
const SocialIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/>
  </svg>
);

const ChannelIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    <line x1="9" y1="10" x2="15" y2="10"/>
  </svg>
);

const WebsiteIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);

const VideoIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
    <polygon points="10,8 16,11 10,14"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
);

const SurveyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

const DownloadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const SignupIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="8.5" cy="7" r="4"/>
    <line x1="20" y1="8" x2="20" y2="14"/>
    <line x1="23" y1="11" x2="17" y2="11"/>
  </svg>
);

const ClipboardIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const AlertIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);

const LightbulbIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="9" y1="18" x2="15" y2="18"/>
    <line x1="10" y1="22" x2="14" y2="22"/>
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>
  </svg>
);

const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const ChartIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);

const HourglassIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 22h14"/>
    <path d="M5 2h14"/>
    <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/>
    <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>
  </svg>
);

const PencilIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
  </svg>
);

const CameraIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);

const CameraUploadIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);

const LockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const UnlockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
  </svg>
);

const CalculatorIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2"/>
    <line x1="8" y1="6" x2="16" y2="6"/>
    <line x1="8" y1="10" x2="8" y2="10"/>
    <line x1="12" y1="10" x2="12" y2="10"/>
    <line x1="16" y1="10" x2="16" y2="10"/>
    <line x1="8" y1="14" x2="8" y2="14"/>
    <line x1="12" y1="14" x2="12" y2="14"/>
    <line x1="16" y1="14" x2="16" y2="14"/>
    <line x1="8" y1="18" x2="8" y2="18"/>
    <line x1="12" y1="18" x2="12" y2="18"/>
    <line x1="16" y1="18" x2="16" y2="18"/>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

function Tasks() {
  const { updateUser } = useAuth();
  const { settings } = useSettings();
  const { tasks: cachedTasks, fetchTasks: fetchCachedTasks } = useData();
  const [tasks, setTasks] = useState(cachedTasks || []);
  const [loading, setLoading] = useState(!cachedTasks);
  const [submitting, setSubmitting] = useState(null);
  const [error, setError] = useState(null);
  const [proofModal, setProofModal] = useState(null);
  const [proofType, setProofType] = useState('text');
  const [proof, setProof] = useState('');
  const [proofImage, setProofImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);
  
  // In-app browser modal state
  const [browserModal, setBrowserModal] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [visitStartTime, setVisitStartTime] = useState(null);
  const [isVisitComplete, setIsVisitComplete] = useState(false);
  
  // Math puzzle state
  const [puzzle, setPuzzle] = useState(null);
  const [puzzleAnswer, setPuzzleAnswer] = useState('');
  const [puzzleError, setPuzzleError] = useState('');
  const [puzzleSolved, setPuzzleSolved] = useState(false);
  const [puzzleAttempts, setPuzzleAttempts] = useState(0);
  
  // Success popup state
  const [successPopup, setSuccessPopup] = useState(null);
  
  // Turnstile state for security verification
  const turnstile = useTurnstile(settings?.turnstile?.siteKey);
  
  // Minimum time for tasks without explicit minVisitDuration (in seconds)
  const DEFAULT_MIN_VISIT_DURATION = 10;
  
  const countdownRef = useRef(null);
  const puzzleInputRef = useRef(null);

  // Debug logger helper
  const logDebug = useCallback((message, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}${data ? ': ' + JSON.stringify(data) : ''}`;
    console.log(logEntry);
    setDebugLogs(prev => [...prev.slice(-19), logEntry]);
  }, []);

  const fetchTasks = useCallback(async () => {
    logDebug('Fetching tasks (with cache)...');
    try {
      const data = await fetchCachedTasks();
      if (data) {
        logDebug('Tasks received', { count: data?.length });
        setTasks(data);
        setError(null);
      }
    } catch (err) {
      const errorDetails = {
        message: err.message,
        status: err.response?.status,
        isNetworkError: !err.response
      };
      logDebug('Tasks fetch error', errorDetails);
      setError(`Failed to load tasks: ${err.response?.data?.message || err.message}`);
      console.error('Tasks error:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchCachedTasks, logDebug]);

  useEffect(() => {
    // Use cached data immediately
    if (cachedTasks) {
      setTasks(cachedTasks);
      setLoading(false);
    }
    // Fetch fresh data
    fetchTasks();
  }, [fetchTasks, cachedTasks]);

  // Cleanup countdown interval on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  // Start in-app browser with time tracking and puzzle
  const handleTaskCardClick = async (task) => {
    // Reset puzzle state
    const newPuzzle = generateMathPuzzle();
    setPuzzle(newPuzzle);
    setPuzzleAnswer('');
    setPuzzleError('');
    setPuzzleSolved(false);
    setPuzzleAttempts(0);
    
    // Determine visit duration - use task's minVisitDuration or default
    const visitDuration = (task.minVisitDuration && task.minVisitDuration > 0) 
      ? task.minVisitDuration 
      : DEFAULT_MIN_VISIT_DURATION;
    
    // Set up modal - URLs will be opened externally (Telegram doesn't support iframes)
    const hasUrl = !!task.url;
    setBrowserModal({...task, effectiveMinDuration: visitDuration, hasUrl});
    setTimeRemaining(visitDuration);
    setVisitStartTime(Date.now());
    setIsVisitComplete(false);
    
    // Notify backend that visit started
    try {
      await axios.post('/tasks/start-visit', { taskId: task._id });
    } catch (err) {
      console.log('Visit start notification failed:', err);
    }
    
    // Auto-open URL in external browser if task has one
    if (hasUrl) {
      const tg = window.Telegram?.WebApp;
      if (tg && tg.openLink) {
        try {
          tg.openLink(task.url);
        } catch (err) {
          window.open(task.url, '_blank');
        }
      } else {
        window.open(task.url, '_blank');
      }
    }
    
    // Start countdown
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    
    countdownRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          setIsVisitComplete(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // State to track if URL was opened
  const [urlOpened, setUrlOpened] = useState(false);
  
  // Reset urlOpened when modal opens
  useEffect(() => {
    if (browserModal && browserModal.hasUrl) {
      setUrlOpened(true);
    } else {
      setUrlOpened(false);
    }
  }, [browserModal]);

  // Handle puzzle answer submission
  const handlePuzzleSubmit = () => {
    if (!puzzle || !puzzleAnswer.trim()) return;
    
    const userAnswer = puzzleAnswer.trim();
    
    if (userAnswer === puzzle.answer) {
      setPuzzleSolved(true);
      setPuzzleError('');
      // Focus will naturally move to the complete button
    } else {
      setPuzzleAttempts(prev => prev + 1);
      setPuzzleError('Incorrect answer. Try again!');
      setPuzzleAnswer('');
      
      // Generate a new puzzle after 3 failed attempts
      if (puzzleAttempts >= 2) {
        const newPuzzle = generateMathPuzzle();
        setPuzzle(newPuzzle);
        setPuzzleAttempts(0);
        setPuzzleError('Too many wrong answers. New puzzle generated.');
      }
      
      // Focus back on input
      if (puzzleInputRef.current) {
        puzzleInputRef.current.focus();
      }
    }
  };

  // Handle keyboard enter on puzzle input
  const handlePuzzleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handlePuzzleSubmit();
    }
  };

  // Check if task can be completed
  const canCompleteTask = useMemo(() => {
    return isVisitComplete && puzzleSolved;
  }, [isVisitComplete, puzzleSolved]);

  // Handle task completion from browser modal
  const handleCompleteFromBrowser = async () => {
    if (!browserModal) return;
    
    // Double check both conditions
    if (!isVisitComplete) {
      setError('Please wait for the timer to complete.');
      return;
    }
    
    if (!puzzleSolved) {
      setError('Please solve the puzzle to verify completion.');
      return;
    }
    
    const visitDuration = Math.floor((Date.now() - visitStartTime) / 1000);
    
    if (browserModal.requiresProof) {
      // Close browser and show proof modal
      clearInterval(countdownRef.current);
      const task = browserModal;
      setBrowserModal(null);
      setProofModal(task);
      setProofType('text');
      setProof('');
      setProofImage(null);
      setImagePreview(null);
    } else {
      // Auto-complete the task
      await submitTask(browserModal._id, '', visitDuration);
    }
  };

  // Close browser modal
  const closeBrowserModal = () => {
    clearInterval(countdownRef.current);
    setBrowserModal(null);
    setTimeRemaining(0);
    setVisitStartTime(null);
    setIsVisitComplete(false);
    setPuzzle(null);
    setPuzzleAnswer('');
    setPuzzleError('');
    setPuzzleSolved(false);
    setPuzzleAttempts(0);
    // Reset Turnstile when closing modal
    turnstile.reset();
  };

  // Open task URL in external browser (Telegram WebApp compatible)
  const openInExternalBrowser = useCallback(() => {
    if (!browserModal || !browserModal.url) return;
    
    // Check if running in Telegram WebApp
    const tg = window.Telegram?.WebApp;
    
    if (tg && tg.openLink) {
      // Use Telegram's openLink for external URLs
      try {
        tg.openLink(browserModal.url);
      } catch (err) {
        // Fallback to window.open if Telegram API fails
        console.log('Telegram openLink failed, using fallback:', err);
        window.open(browserModal.url, '_blank');
      }
    } else {
      // Fallback for non-Telegram environments
      window.open(browserModal.url, '_blank');
    }
  }, [browserModal]);

  const submitTask = async (taskId, proofText = '', visitDuration = 0) => {
    // Check Turnstile verification if enabled
    if (settings?.turnstile?.enabled && !turnstile.token) {
      setError('Please complete the security verification first');
      return;
    }
    
    setSubmitting(taskId);
    setError(null);
    
    try {
      // Include puzzle data for server-side verification
      const puzzleVerification = puzzle ? {
        num1: puzzle.num1,
        num2: puzzle.num2,
        operation: puzzle.operation,
        userAnswer: puzzle.answer // The correct answer the user provided
      } : null;
      
      const response = await axios.post('/tasks/submit', { 
        taskId, 
        proof: proofText,
        visitDuration: visitDuration,
        visitStartTime: visitStartTime,
        puzzleData: puzzleVerification,
        turnstileToken: turnstile.token
      });
      
      // Close any open modals and reset puzzle state
      setBrowserModal(null);
      setProofModal(null);
      setProof('');
      setPuzzle(null);
      setPuzzleAnswer('');
      setPuzzleSolved(false);
      setPuzzleError('');
      setPuzzleAttempts(0);
      clearInterval(countdownRef.current);
      
      if (response.data.autoApproved) {
        // Show success popup for auto-approved tasks
        setSuccessPopup({
          reward: response.data.reward,
          newBalance: response.data.newBalance,
          taskTitle: tasks.find(t => t._id === taskId)?.title || 'Task'
        });
        
        // Refresh user data
        const userResponse = await axios.get('/user/dashboard');
        updateUser(userResponse.data.user);
        
        // Remove task from list immediately
        setTasks(prev => prev.filter(t => t._id !== taskId));
      } else {
        // Task submitted for review
        setSuccessPopup({
          pending: true,
          taskTitle: tasks.find(t => t._id === taskId)?.title || 'Task'
        });
        
        // Update task status in list
        setTasks(prev => prev.map(t => 
          t._id === taskId ? { ...t, submitted: true, submissionStatus: 'pending' } : t
        ));
      }
      
      // Auto-close success popup after 3 seconds
      setTimeout(() => {
        setSuccessPopup(null);
      }, 3000);
      
      // Reset Turnstile after successful submission
      turnstile.reset();
      
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to submit task');
      // Reset Turnstile on error
      turnstile.reset();
    } finally {
      setSubmitting(null);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }
      setProofImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setProofImage(null);
    setImagePreview(null);
  };

  const uploadImage = async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  };

  const handleSubmitProof = async () => {
    const visitDuration = visitStartTime ? Math.floor((Date.now() - visitStartTime) / 1000) : 0;
    
    if (proofType === 'image' && proofImage) {
      setUploadingImage(true);
      try {
        const imageUrl = await uploadImage(proofImage);
        await submitTask(proofModal._id, imageUrl, visitDuration);
      } catch (err) {
        setError('Failed to upload image');
      } finally {
        setUploadingImage(false);
      }
    } else if (proofType === 'text' && proof.trim()) {
      await submitTask(proofModal._id, proof, visitDuration);
    }
  };

  const getTaskIcon = (type) => {
    const icons = {
      social: <SocialIcon />,
      join_channel: <ChannelIcon />,
      visit_website: <WebsiteIcon />,
      watch_video: <VideoIcon />,
      survey: <SurveyIcon />,
      download: <DownloadIcon />,
      signup: <SignupIcon />,
      other: <ClipboardIcon />
    };
    return icons[type] || <ClipboardIcon />;
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return mins + ':' + secs.toString().padStart(2, '0');
    }
    return secs + 's';
  };

  const currencyName = settings?.currencyName || 'Coins';

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="container page-content">
          <div className="loading">
            <div className="loading-spinner"></div>
            <p>Loading tasks...</p>
          </div>
        </div>
        <BottomNav />
      </>
    );
  }

  if (error && tasks.length === 0) {
    return (
      <>
        <Navbar />
        <div className="container page-content">
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ marginBottom: '16px', color: 'var(--warning-color)' }}><AlertIcon /></div>
            <h3 style={{ marginBottom: '12px' }}>Failed to Load Tasks</h3>
            <p className="text-muted" style={{ marginBottom: '20px' }}>{error}</p>
            <button 
              className="btn btn-primary"
              onClick={() => {
                setError(null);
                setLoading(true);
                fetchTasks();
              }}
            >
              <RefreshIcon /> Try Again
            </button>
          </div>
          
          {/* Debug Panel */}
          <div className="card" style={{ marginTop: '16px', textAlign: 'left' }}>
            <h4 style={{ marginBottom: '12px', fontSize: '14px' }}>🔍 Debug Info</h4>
            <div style={{ fontSize: '11px', fontFamily: 'monospace', background: '#1a1a2e', color: '#0f0', padding: '12px', borderRadius: '8px', maxHeight: '200px', overflow: 'auto' }}>
              <div style={{ marginBottom: '8px', color: '#ff0' }}>
                API URL: {axios.defaults.baseURL}
              </div>
              <div style={{ marginBottom: '8px', color: '#ff0' }}>
                Token: {localStorage.getItem('token') ? 'Present' : 'Missing'}
              </div>
              <div style={{ borderTop: '1px solid #333', paddingTop: '8px', marginTop: '8px' }}>
                {debugLogs.map((log, i) => (
                  <div key={i} style={{ marginBottom: '4px', wordBreak: 'break-all' }}>{log}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="container page-content">
        {error && <div className="error">{error}</div>}

        {/* Header */}
        <div className="card card-gradient">
          <h2 style={{ color: '#fff', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircleIcon /> Complete Tasks
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>
            Tap a task to start earning instantly
          </p>
        </div>

        {/* Available Tasks */}
        {tasks.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon"><ClipboardIcon /></div>
              <h3 className="empty-state-title">No Tasks Available</h3>
              <p className="empty-state-description">
                Check back later for new tasks to complete.
              </p>
            </div>
          </div>
        ) : (
          <div className="task-list">
            {tasks.map((task) => {
              const hasExplicitMinDuration = task.minVisitDuration && task.minVisitDuration > 0;
              const effectiveDuration = hasExplicitMinDuration ? task.minVisitDuration : DEFAULT_MIN_VISIT_DURATION;
              const hasLimitedSlots = task.maxCompletions > 0;
              
              return (
                <div 
                  key={task._id} 
                  className={'task-card task-card-clickable' + (task.submissionStatus ? ' task-card-submitted' : '')}
                  onClick={() => !task.submissionStatus && !submitting && handleTaskCardClick(task)}
                  style={{ cursor: task.submissionStatus || submitting ? 'not-allowed' : 'pointer' }}
                >
                  <div className="task-card-icon">
                    {getTaskIcon(task.type)}
                  </div>
                  <div className="task-card-content">
                    <div className="task-card-title">{task.title}</div>
                    {task.description && (
                      <div className="task-card-description">{task.description}</div>
                    )}
                    <div className="task-card-meta">
                      <span className="task-card-reward">+{task.reward} {currencyName}</span>
                      <span className="task-card-duration" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <ClockIcon /> {formatTime(effectiveDuration)}
                      </span>
                      {hasLimitedSlots && (
                        <span className="task-card-slots" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <ChartIcon /> {task.remainingSlots} left
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="task-card-actions">
                    {task.submissionStatus === 'pending' ? (
                      <span className="task-status-badge task-status-pending" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <HourglassIcon /> Pending
                      </span>
                    ) : submitting === task._id ? (
                      <div className="loading-spinner" style={{ width: '24px', height: '24px' }}></div>
                    ) : (
                      <span className="task-card-arrow">▶</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tips */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <span className="card-icon tips-icon"><LightbulbIcon /></span>
              Tips
            </h2>
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            <p style={{ marginBottom: '8px' }}>• Tap on a task card to start the task</p>
            <p style={{ marginBottom: '8px' }}>• Wait for the timer to complete</p>
            <p style={{ marginBottom: '8px' }}>• Solve the math puzzle to verify completion</p>
            <p>• Some tasks may require proof submission</p>
          </div>
        </div>
      </div>

      {/* In-App Browser Modal with Timer and Puzzle */}
      {browserModal && (
        <div className="browser-modal-overlay">
          <div className="browser-modal">
            <div className="browser-modal-header">
              <div className="browser-modal-title">
                {browserModal.title}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {browserModal.url && (
                  <button 
                    className="browser-external-btn" 
                    onClick={openInExternalBrowser}
                    title="Open in new tab"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <ExternalLinkIcon />
                  </button>
                )}
                <button 
                  className="browser-modal-close" 
                  onClick={closeBrowserModal}
                  title="Cancel and close"
                >
                  ×
                </button>
              </div>
            </div>
            
            {/* Timer Section */}
            <div className="browser-modal-timer" style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.05) 100%)',
              padding: '14px 16px',
              borderRadius: '0',
              borderBottom: '1px solid var(--border-color)'
            }}>
              {!isVisitComplete ? (
                <>
                  <div className="timer-circle" style={{
                    width: '48px',
                    height: '48px',
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
                    border: 'none'
                  }}>
                    <span className="timer-value" style={{ color: '#ffffff', fontSize: '18px', fontWeight: '700' }}>{timeRemaining}</span>
                    <span className="timer-label" style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '8px', marginTop: '1px' }}>sec</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{
                      color: 'var(--text-primary)',
                      fontWeight: '600',
                      fontSize: '13px',
                      margin: '0 0 2px 0'
                    }}>
                      Minimum Visit Time
                    </p>
                    <p style={{
                      color: 'var(--text-secondary)',
                      fontWeight: '400',
                      fontSize: '11px',
                      margin: 0
                    }}>
                      {browserModal.hasUrl 
                        ? `Complete task & wait ${formatTime(browserModal.effectiveMinDuration)}`
                        : `Wait ${formatTime(browserModal.effectiveMinDuration)} to continue`
                      }
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="timer-circle timer-complete" style={{
                    width: '48px',
                    height: '48px',
                    background: 'linear-gradient(135deg, #10b981 0%, #22c55e 100%)',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                    border: 'none'
                  }}>
                    <span className="timer-value" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}><CheckCircleIcon /></span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{
                      color: 'var(--success-color)',
                      fontWeight: '600',
                      fontSize: '13px',
                      margin: 0
                    }}>Time Complete ✓</p>
                  </div>
                </>
              )}
            </div>
            
            {/* Content Section - Task info and open link button */}
            <div className="browser-modal-content" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              background: 'var(--bg-card)',
              minHeight: '180px',
              padding: '24px'
            }}>
              <div style={{ textAlign: 'center', maxWidth: '300px' }}>
                <div style={{ 
                  marginBottom: '16px', 
                  color: 'var(--primary-color)',
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'rgba(99, 102, 241, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px'
                }}>
                  {getTaskIcon(browserModal.type)}
                </div>
                
                {browserModal.description && (
                  <p style={{ 
                    color: 'var(--text-secondary)', 
                    fontSize: '14px',
                    marginBottom: '16px',
                    lineHeight: '1.5'
                  }}>
                    {browserModal.description}
                  </p>
                )}
                
                {browserModal.hasUrl && (
                  <>
                    {urlOpened ? (
                      <div style={{
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        marginBottom: '12px'
                      }}>
                        <p style={{ 
                          color: 'var(--success-color)', 
                          fontSize: '13px',
                          fontWeight: '500',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}>
                          <CheckCircleIcon /> Link opened in browser
                        </p>
                      </div>
                    ) : null}
                    
                    <button
                      onClick={openInExternalBrowser}
                      className="btn btn-primary"
                      style={{
                        width: '100%',
                        padding: '12px 20px',
                        fontSize: '15px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      <ExternalLinkIcon />
                      {urlOpened ? 'Open Link Again' : 'Open Task Link'}
                    </button>
                    
                    <p style={{ 
                      color: 'var(--text-muted)', 
                      fontSize: '12px',
                      marginTop: '12px'
                    }}>
                      Complete the task in the browser, then return here
                    </p>
                  </>
                )}
                
                {!browserModal.hasUrl && (
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    Wait for the timer and solve the puzzle below
                  </p>
                )}
              </div>
            </div>
            
            {/* Math Puzzle Section */}
            <div className="puzzle-section" style={{
              padding: '18px 16px',
              background: puzzleSolved 
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(52, 211, 153, 0.1) 100%)' 
                : 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(251, 191, 36, 0.08) 100%)',
              borderTop: puzzleSolved ? '2px solid rgba(16, 185, 129, 0.3)' : '2px solid rgba(245, 158, 11, 0.3)',
              borderBottom: '1px solid var(--border-color)'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px', 
                marginBottom: '14px'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: puzzleSolved 
                    ? 'linear-gradient(135deg, #10b981 0%, #22c55e 100%)' 
                    : 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  boxShadow: puzzleSolved 
                    ? '0 2px 8px rgba(16, 185, 129, 0.3)' 
                    : '0 2px 8px rgba(245, 158, 11, 0.3)'
                }}>
                  {puzzleSolved ? <UnlockIcon /> : <LockIcon />}
                </div>
                <span style={{ 
                  fontWeight: '600', 
                  fontSize: '14px',
                  color: puzzleSolved ? 'var(--success-color)' : 'var(--warning-color)'
                }}>
                  {puzzleSolved ? 'Verification Complete!' : 'Solve to Verify'}
                </span>
              </div>
              
              {!puzzleSolved ? (
                <div className="puzzle-container">
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    {/* Math Question Display */}
                    <div style={{
                      background: 'var(--bg-primary)',
                      padding: '14px 20px',
                      borderRadius: '12px',
                      fontSize: '22px',
                      fontWeight: '700',
                      color: 'var(--text-primary)',
                      fontFamily: 'monospace',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      border: '1px solid var(--border-color)'
                    }}>
                      <CalculatorIcon />
                      {puzzle?.question} = ?
                    </div>
                    
                    {/* Input and Button Row */}
                    <div style={{ 
                      display: 'flex', 
                      gap: '10px', 
                      alignItems: 'stretch'
                    }}>
                      <input
                        ref={puzzleInputRef}
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className="puzzle-input"
                        value={puzzleAnswer}
                        onChange={(e) => setPuzzleAnswer(e.target.value)}
                        onKeyDown={handlePuzzleKeyDown}
                        placeholder="?"
                        disabled={!isVisitComplete}
                        style={{
                          width: '100px',
                          minWidth: '80px',
                          maxWidth: '120px',
                          padding: '12px 16px',
                          fontSize: '20px',
                          fontWeight: '700',
                          border: puzzleError ? '2px solid var(--danger-color)' : '2px solid var(--border-color)',
                          borderRadius: '12px',
                          background: isVisitComplete ? 'var(--bg-card)' : 'rgba(128,128,128,0.2)',
                          color: 'var(--text-primary)',
                          textAlign: 'center',
                          outline: 'none',
                          transition: 'all 0.2s',
                          fontFamily: 'monospace'
                        }}
                      />
                      <button
                        onClick={handlePuzzleSubmit}
                        disabled={!isVisitComplete || !puzzleAnswer.trim()}
                        className="btn btn-primary"
                        style={{
                          flex: 1,
                          padding: '12px 24px',
                          fontSize: '15px',
                          fontWeight: '600',
                          opacity: (!isVisitComplete || !puzzleAnswer.trim()) ? 0.5 : 1,
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          margin: 0
                        }}
                      >
                        <CheckCircleIcon /> Verify
                      </button>
                    </div>
                  </div>
                  
                  {puzzleError && (
                    <p style={{ 
                      color: 'var(--danger-color)', 
                      fontSize: '13px', 
                      marginTop: '8px',
                      marginBottom: 0
                    }}>
                      {puzzleError}
                    </p>
                  )}
                  
                  {!isVisitComplete && (
                    <p style={{ 
                      color: 'var(--text-muted)', 
                      fontSize: '12px', 
                      marginTop: '8px',
                      marginBottom: 0,
                      fontStyle: 'italic'
                    }}>
                      Wait for the timer to complete before solving the puzzle.
                    </p>
                  )}
                </div>
              ) : (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  color: 'var(--success-color)',
                  fontSize: '14px'
                }}>
                  <CheckCircleIcon />
                  <span>Puzzle solved correctly! You can now complete the task.</span>
                </div>
              )}
            </div>
            
            <div className="browser-modal-footer">
              {/* Turnstile Verification */}
              {settings?.turnstile?.enabled && puzzleSolved && isVisitComplete && (
                <div style={{ width: '100%', marginBottom: '12px' }}>
                  <Turnstile
                    siteKey={settings.turnstile.siteKey}
                    onVerify={turnstile.handleVerify}
                    onError={turnstile.handleError}
                    onExpire={turnstile.handleExpire}
                    theme="dark"
                  />
                </div>
              )}
              <button 
                className="btn btn-secondary"
                onClick={closeBrowserModal}
              >
                Cancel
              </button>
              <button 
                className={'btn ' + (canCompleteTask ? 'btn-success' : 'btn-primary')}
                onClick={handleCompleteFromBrowser}
                disabled={!canCompleteTask || submitting === browserModal._id || (settings?.turnstile?.enabled && !turnstile.token)}
              >
                {submitting === browserModal._id ? (
                  <>
                    <div className="loading-spinner" style={{ width: '18px', height: '18px', marginRight: '8px' }}></div>
                    Completing...
                  </>
                ) : canCompleteTask ? (
                  settings?.turnstile?.enabled && !turnstile.token ? (
                    <><LockIcon /> Complete Verification</>
                  ) : (
                    <><CheckCircleIcon /> Complete Task</>
                  )
                ) : !isVisitComplete ? (
                  <><HourglassIcon /> Wait {timeRemaining}s</>
                ) : (
                  <><LockIcon /> Solve Puzzle</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proof Modal */}
      {proofModal && (
        <div className="modal-overlay" onClick={() => setProofModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Submit Proof</h2>
              <button className="modal-close" onClick={() => setProofModal(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                Proof for: <strong>{proofModal.title}</strong>
              </p>
              
              {/* Proof Type Toggle */}
              <div className="proof-type-toggle">
                <button 
                  className={'proof-type-btn ' + (proofType === 'text' ? 'active' : '')}
                  onClick={() => setProofType('text')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <PencilIcon /> Text
                </button>
                <button 
                  className={'proof-type-btn ' + (proofType === 'image' ? 'active' : '')}
                  onClick={() => setProofType('image')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <CameraIcon /> Image
                </button>
              </div>

              {proofType === 'text' ? (
                <div className="form-group">
                  <textarea
                    className="form-control"
                    rows="3"
                    value={proof}
                    onChange={(e) => setProof(e.target.value)}
                    placeholder="Username, email, or description..."
                  />
                </div>
              ) : (
                <div className="form-group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ display: 'none' }}
                    id="proof-image-input"
                  />
                  {imagePreview ? (
                    <div className="image-upload-area has-image">
                      <div className="image-preview-container">
                        <img src={imagePreview} alt="Proof" className="image-preview" />
                        <button 
                          className="image-remove-btn"
                          onClick={removeImage}
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label htmlFor="proof-image-input" className="image-upload-area">
                      <div className="image-upload-icon"><CameraUploadIcon /></div>
                      <div className="image-upload-text">Tap to upload screenshot</div>
                      <div className="image-upload-subtext">Max 5MB • JPG, PNG, WEBP</div>
                    </label>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              {/* Turnstile Verification for Proof Submission */}
              {settings?.turnstile?.enabled && (
                <div style={{ width: '100%', marginBottom: '12px' }}>
                  <Turnstile
                    siteKey={settings.turnstile.siteKey}
                    onVerify={turnstile.handleVerify}
                    onError={turnstile.handleError}
                    onExpire={turnstile.handleExpire}
                    theme="dark"
                  />
                </div>
              )}
              <button 
                className="btn btn-secondary" 
                onClick={() => setProofModal(null)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleSubmitProof}
                disabled={
                  (proofType === 'text' && !proof.trim()) ||
                  (proofType === 'image' && !proofImage) ||
                  submitting === proofModal._id ||
                  uploadingImage ||
                  (settings?.turnstile?.enabled && !turnstile.token)
                }
              >
                {uploadingImage ? 'Uploading...' : submitting === proofModal._id ? 'Submitting...' : (settings?.turnstile?.enabled && !turnstile.token) ? 'Complete Verification' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Popup */}
      <SuccessPopup
        show={!!successPopup}
        onClose={() => setSuccessPopup(null)}
        type={successPopup?.pending ? 'pending' : 'task'}
        reward={successPopup?.reward}
        currencyName={currencyName}
        newBalance={successPopup?.newBalance}
        taskTitle={successPopup?.taskTitle}
      />

      <BottomNav />
    </>
  );
}

export default Tasks;
