document.addEventListener("DOMContentLoaded", () => {
  const createRoomForm = document.getElementById("create-room-form");

  if (createRoomForm) {
    createRoomForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("room-name").value.trim();
      const description = document.getElementById("room-description").value.trim();

      const userId = localStorage.getItem("userId"); // Retrieve userId from localStorage
      if (!userId) {
        alert("You must be signed in to create a room.");
        return;
      }

      try {
        var token = localStorage.getItem("token"); // Retrieve token from localStorage
        const res = await fetch("http://localhost:3000/create-room", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token,  // Send the userId in the Authorization header
          },
          body: JSON.stringify({ name, description }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(errorText);
        }

        const data = await res.json();
        alert("Room created successfully!");
        window.location.href = "chat.html";  // Redirect to the chat room page
      } catch (error) {
        console.error("Error creating room:", error);
        alert("Error creating room: " + error.message);
      }
    });
  }
});
