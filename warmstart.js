const warmStart = () => {setInterval(async () => {
  try {
    await fetch("https://chat-app-backend-yx1q.onrender.com/api/servercheck");
    console.log("Warmstarted");
  } catch (err) {
    console.error("warmstart error: ", err);
  }
}, 1000 * 60 * 5); //5 min
};
warmStart();