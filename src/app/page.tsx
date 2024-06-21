"use client";

import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import Webcam from "react-webcam";
import styles from "./styles.module.css";

const Home = () => {
  const videoRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [blinkCount, setBlinkCount] = useState(0);
  const [nowBlinking, setNowBlinking] = useState(false);
  const [irisC, setIrisC] = useState<number[]>([]);
  // const mBlinkSound = new Audio("/sound/shotgun-firing1.mp3");

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = "/facemodels";
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      ]);
      setModelsLoaded(true);
    };
    loadModels();
  }, []);

  useEffect(() => {
    const startVideo = async () => {
      const video = videoRef.current?.video as HTMLVideoElement;
      if (!video) return;

      if (navigator.userAgent.match(/iPhone|iPad|Android/)) {
        console.log("Mobile");
        video.width = 400;

        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          video.srcObject = stream;
          video.play();
        } catch (err) {
          console.error("Not available!!!!", err);
        }
      } else {
        console.log("PC");
        navigator.mediaDevices
          .getUserMedia({ video: true })
          .then((stream: MediaStream) => {
            video.srcObject = stream;
            video.play();
          })
          .catch((err: any) => console.error(err));
      }
    };

    if (modelsLoaded) {
      startVideo();
    }
  }, [modelsLoaded]);

  useEffect(() => {
    const handleVideoPlay = () => {
      const video = videoRef.current?.video as HTMLVideoElement;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      // Ensure video dimensions are set
      const displaySize = {
        width: video.videoWidth,
        height: video.videoHeight,
      };

      if (displaySize.width === 0 || displaySize.height === 0) {
        console.error("Invalid video dimensions:", displaySize);
        return;
      }

      faceapi.matchDimensions(canvas, displaySize);

      const canvas_bg = document.createElement("canvas");
      canvas_bg.width = video.videoWidth;
      canvas_bg.height = video.videoHeight;
      document.body.append(canvas_bg);
      const ctx_bg = canvas_bg.getContext("2d");

      const canvas_face = document.createElement("canvas");
      canvas_face.width = video.videoWidth;
      canvas_face.height = video.videoHeight;
      const ctx_face = canvas_face.getContext("2d");

      let t1 = performance.now();

      const interval = setInterval(async () => {
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks();
        const resizedDetections = faceapi.resizeResults(
          detections,
          displaySize
        );
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);

        if (resizedDetections.length > 0) {
          const landmarks = resizedDetections[0].landmarks.positions;

          ctx_bg?.clearRect(0, 0, canvas_bg.width, canvas_bg.height);
          let x_ = landmarks[37].x;
          let y_ = landmarks[37].y;
          let w_ = landmarks[38].x - landmarks[37].x;
          let h_ = landmarks[41].y - landmarks[37].y;
          ctx_bg?.fillRect(x_, y_, w_, h_);

          x_ = landmarks[43].x;
          y_ = landmarks[43].y;
          w_ = landmarks[44].x - landmarks[43].x;
          h_ = landmarks[47].y - landmarks[43].y;
          ctx_bg?.fillRect(x_, y_, w_, h_);

          ctx_face?.clearRect(0, 0, canvas_face.width, canvas_face.height);
          ctx_face?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
          const frame = ctx_face?.getImageData(
            0,
            0,
            video.videoWidth,
            video.videoHeight
          );
          if (frame) {
            const p_ =
              Math.floor(x_ + w_ / 2) +
              Math.floor(y_ + h_ / 2) * video.videoWidth;
            const v_ = Math.floor(
              (frame.data[p_ * 4 + 0] +
                frame.data[p_ * 4 + 1] +
                frame.data[p_ * 4 + 2]) /
                3
            );

            setIrisC((prev) => {
              const newIrisC = [...prev, v_];
              if (newIrisC.length > 100) newIrisC.shift();
              return newIrisC;
            });
          }

          const meanIrisC =
            irisC.reduce((sum, val) => sum + val, 0) / irisC.length;
          const vThreshold = 1.5;
          const currentIrisC = irisC[irisC.length - 1];

          if (irisC.length === 100) {
            if (!nowBlinking && currentIrisC >= meanIrisC * vThreshold) {
              setNowBlinking(true);
            } else if (nowBlinking && currentIrisC < meanIrisC * vThreshold) {
              setNowBlinking(false);
              setBlinkCount((prev) => prev + 1);
              // mBlinkSound.pause();
              // mBlinkSound.currentTime = 0;
              // mBlinkSound.play();
            }
          }

          if (ctx_bg) {
            ctx_bg.strokeStyle = "red";
            ctx_bg.lineWidth = 5;
            const Ox = 0;
            const Oy = canvas_bg.height / 2;
            const Lx = canvas_bg.width;
            const Ly = canvas_bg.height / 2;
            let vx = (0 / irisC.length) * Lx;
            let vy = (irisC[0] / 255) * Ly;
            ctx_bg.beginPath();
            ctx_bg.moveTo(Ox + vx, Oy - vy);
            for (let i = 1; i < irisC.length; i++) {
              vx = (i / irisC.length) * Lx;
              vy = (irisC[i] / 255) * Ly;
              ctx_bg.lineTo(Ox + vx, Oy - vy);
            }
            ctx_bg.stroke();

            ctx_bg.strokeStyle = "rgb(0,255,0)";
            ctx_bg.lineWidth = 2;
            ctx_bg.beginPath();
            vx = 0 * Lx;
            vy = ((meanIrisC * vThreshold) / 255) * Ly;
            ctx_bg.moveTo(Ox + vx, Oy - vy);
            vx = 1 * Lx;
            ctx_bg.lineTo(Ox + vx, Oy - vy);
            ctx_bg.stroke();

            const t2 = performance.now();
            if (ctx) {
              ctx.font = "48px serif";
              ctx.fillText("FPS:" + Math.floor(1000.0 / (t2 - t1)), 10, 50);
              ctx.fillText("Count:" + blinkCount, 10, 100);
              if (nowBlinking) {
                ctx.fillText("Blinking", 10, 150);
              }
            }
            t1 = t2;
          }
        }
      }, 33);

      return () => clearInterval(interval);
    };

    if (videoRef.current) {
      const video = videoRef.current.video as HTMLVideoElement;
      video.addEventListener("play", handleVideoPlay);
      return () => {
        video.removeEventListener("play", handleVideoPlay);
      };
    }
  }, [modelsLoaded, irisC, nowBlinking]);

  return (
    <div className={styles.container}>
      <Webcam
        ref={videoRef}
        className={styles.video}
        onLoadedMetadata={() => {
          const video = videoRef.current?.video as HTMLVideoElement;
          if (video) {
            video.play();
          }
        }}
      />
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.info}>
        <p>FPS: {Math.floor(1000.0 / 33)}</p>
        <p>Blink Count: {blinkCount}</p>
        {nowBlinking && <p>Blinking</p>}
      </div>
    </div>
  );
};

export default Home;
