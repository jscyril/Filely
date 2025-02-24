'use client';

import '../globals.css'
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import ProgressBar from '../../Components/ui/progressBar';
import { useFilelyStore } from '@/stores/filelyStore';
import RecieverPage from '@/Components/ui/recieverPage';
import { ConnectStatus, useRoomStore } from '@/stores/roomStore';


const socket = io("https://filely-3hg5.onrender.com");

export default function Connect (){
  // ZUSTAND initializing
  const file= useFilelyStore((state) => state.FILE);
  const connectionStatus = useRoomStore(state => state.ConnectionStatus);
  const setConnectionStatus = useRoomStore((state) => state.setConnectionStatus);
  const Setdefaulroomid = useRoomStore(state => state.setRoomID);
  // Get query parameters from URL
  const [id,setId] = useState<string >('');
  
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);
  const [roomId, setRoomId] = useState(id || "");
  const [joined, setJoined] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(file);
  const [downloadProgress, setDownloadProgress] = useState<number>(0); 
  const [sendProgress, setsendProgress] = useState<number>(0); 
 
  const [isInitiator,setisInitiator] = useState<boolean>(id? false : true)
  
  //re rendering if neeeded
  useMemo(() => {
    setSelectedFile(file);
    console.log("selected file : " + file);
  }, [file]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tempId = params.get("id");
      if (tempId) {
        setId(tempId);
        setRoomId(tempId);
        setisInitiator(false);
        setConnectionStatus(ConnectStatus.Connecting);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ ]); 

 // Socket connection and services
  useEffect(() => {
  
    socket.on("user-joined", async (userId) => {
      console.log("User joined:", userId);
      await createOffer(userId);
      setConnectionStatus(ConnectStatus.Waiting);
    });

    socket.on("offer", async ({ sender, offer }) => {
      console.log("Received offer from", sender);
      await handleOffer(sender, offer);
      setConnectionStatus(ConnectStatus.Waiting);
    });

    socket.on("answer", async ({ sender, answer }) => {
      console.log("Received answer from", sender);
      await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(answer));
      setConnectionStatus(ConnectStatus.Waiting);
    });

    socket.on("ice-candidate", async ({ sender, candidate }) => {
      if (candidate) {
        console.log("Received ICE candidate:", candidate + "from " + sender);
        await peerConnection.current?.addIceCandidate(new RTCIceCandidate(candidate));
        setConnectionStatus(ConnectStatus.Connecting);
      }
    });

    return () => {
      socket.off("user-joined");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const joinRoom = async () => {
    if (!roomId) return;
    socket.emit("join-room", roomId);
    setJoined(true);
    Setdefaulroomid(roomId);
    createLink();
    setConnectionStatus(ConnectStatus.Waiting);
    createPeerConnection();
  };

  // create peer connection
  const createPeerConnection = () => {
    peerConnection.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    dataChannel.current = peerConnection.current.createDataChannel("fileTransfer");
    setupDataChannel();

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", { target: roomId, candidate: event.candidate });
      }
    };

    peerConnection.current.ondatachannel = (event) => {
      console.log("Received data channel");
      setConnectionStatus( ConnectStatus.Connected);
      dataChannel.current = event.channel;
      setupDataChannel();
    };
  };

    // Data Channel For transferring
    const setupDataChannel = () => {
      if (!dataChannel.current) return;
    
      let receivedMetadata: { name: string; type: string; size: number } | null = null;
      let receivedSize = 0;
      let receivedChunks: ArrayBuffer[] = []; // Store chunks
    
      dataChannel.current.onopen = () => {
        setConnectionStatus(ConnectStatus.Connected);
        console.log("Data channel opened");
      };
      
      dataChannel.current.onclose = () => {
        setConnectionStatus(ConnectStatus.Disconnected);
        console.log("Data channel closed");
      };
    
      dataChannel.current.onmessage = (event) => {
        console.log("Receiving data...");
    
        // Metadata Handling (JSON)
        if (typeof event.data === "string") {
          try {
            const metadata = JSON.parse(event.data);
    
            if (!metadata.name || !metadata.type || !metadata.size) {
              throw new Error("Invalid metadata format");
            }
    
            receivedMetadata = metadata;
            console.log("Received file metadata:", receivedMetadata);
    
            // Reset progress and received data
            setDownloadProgress(0);
            receivedSize = 0;
            receivedChunks = []; // Clear previous chunks
          } catch (error) {
            console.error("Error parsing metadata:", error);
            return;
          }
        } 
        // File Chunk Handling (ArrayBuffer)
        else if (event.data instanceof ArrayBuffer) {
          if (!receivedMetadata) {
            console.error("Received file chunk before metadata!");
            return;
          }
    
          console.log("Received file chunk, size:", event.data.byteLength, "bytes");
    
          receivedSize += event.data.byteLength;
          receivedChunks.push(event.data); // Store the chunk
    
          // Update progress bar
          const progress = (receivedSize / receivedMetadata.size) * 100;
          setDownloadProgress(progress);
    
          if (receivedSize >= receivedMetadata.size) {
            // Merge all chunks into a single Blob
            const receivedBlob = new Blob(receivedChunks, { type: receivedMetadata.type });
    
            // Create a download link
            const url = URL.createObjectURL(receivedBlob);
            const a = document.createElement("a");
            a.href = url;
            a.download = receivedMetadata.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
    
            // Free memory
            URL.revokeObjectURL(url);
            console.log("File download triggered!");
    
            // Reset metadata
            receivedMetadata = null;
            receivedChunks = [];
          }
        } else {
          console.error("Unexpected data format received:", event.data);
        }
      };
    };
  
  // offer creation
  const createOffer = async (userId: string) => {
    if (!peerConnection.current) return;
    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    socket.emit("offer", { target: userId, offer });
  };

  // answer handling
  const handleOffer = async (sender: string, offer: RTCSessionDescriptionInit) => {
    if (!peerConnection.current) {
      createPeerConnection();
    }

    if (!peerConnection.current) return;

    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.current.createAnswer();
    await peerConnection.current.setLocalDescription(answer);
    socket.emit("answer", { target: sender, answer });
  };
// sending file 
const sendFile = () => {
  if (!dataChannel.current || dataChannel.current.readyState !== "open") {
    console.error("Data channel is not open " + dataChannel.current?.readyState);
    setConnectionStatus(ConnectStatus.Failed);
    return;
  }
  if (!selectedFile) return;
  const CHUNK_SIZE = 16 * 1024; // 16KB chunks
  const fileMetadata = JSON.stringify({
      name: selectedFile.name,
      type: selectedFile.type,
      size: selectedFile.size,
  });

  dataChannel.current?.send(fileMetadata);
  console.log("Sending file:", selectedFile.name);
  const reader = new FileReader();
  let offset = 0;

  setsendProgress(0);

  reader.onload = () => {
    const arrayBuffer = reader.result as ArrayBuffer;
    const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE);
    let chunkIndex = 0;

    const sendChunk = () => {
      if (offset < arrayBuffer.byteLength) {
        const chunk = arrayBuffer.slice(offset, offset + CHUNK_SIZE);
        dataChannel.current?.send(chunk);
        offset += CHUNK_SIZE;
        chunkIndex++;

        console.log(`Sent chunk ${chunkIndex}/${totalChunks}, size: ${chunk.byteLength} bytes`);
        setsendProgress((offset / arrayBuffer.byteLength) * 100);
        setTimeout(sendChunk, 10); // Allow time for transmission
      } else {
        console.log("File sent successfully!");
      }
    };

    sendChunk();
  };

  reader.readAsArrayBuffer(selectedFile);
};

  // Copying link to clipboard
  const createLink = ()=>{
    const link = `https://filely.netlify.app/connect?id=${roomId}`
    //const link = `${window.location.origin}/connect?id=${roomId}`;
    try {
      navigator.clipboard.writeText(link);
      alert("Offer copied to clipboard");
    } catch (e) {
      console.error("Failed to copy to clipboard:", e);
      alert("Failed to copy offer to clipboard");

    }
  };


  return (
    <Suspense fallback={<div>Loading...</div>}>
    <div className="flex flex-col items-center justify-center">
      {!joined ? (
        <div>
          <input
            type="text"
            placeholder="Enter Room ID"
            className="border p-2 rounded"
            id="fileInput"
            value={roomId}
            onChange={(e) => { setRoomId(e.target.value);
            }}
          />
          <button
            onClick={joinRoom}
            className="bg-blue-500 text-white p-2 ml-2 rounded"
          >
            Join Room
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          {isInitiator? (
            <div>
              <button onClick={sendFile} className="bg-green-500 text-white p-2 mt-2 rounded" >
                Send
              </button>
              
            </div>
            
            ) : (
            <div className='flex flex-col items-center justify-center align-middle h-screen'>
             <RecieverPage />
             <ProgressBar progress={downloadProgress} type='receiving'/>
             <div className='text-lg text-white mt-10'>Connection Status : {connectionStatus}</div>
            </div>
            )}
            {isInitiator && <ProgressBar progress={sendProgress} type='sending' />}
            <div className='text-lg text-white mt-10'>Connection Status : {connectionStatus}</div>
        </div>
      )}
    </div>
    </Suspense>
  );
};


