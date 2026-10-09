// Accès à la caméra frontale du téléphone ou du PC.
// Les navigateurs n'autorisent la caméra qu'en HTTPS (ou sur localhost).

export async function startCamera(video) {
  if (!window.isSecureContext) {
    throw new Error("INSECURE_CONTEXT");
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  return stream;
}

export function stopCamera(video) {
  const stream = video.srcObject;
  if (stream) stream.getTracks().forEach((track) => track.stop());
  video.srcObject = null;
}
