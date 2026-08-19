// Connexion automatique au serveur (fonctionne en local et sur Render)
const socket = io();

// Exemple de gestion du bouton de connexion
document.addEventListener('DOMContentLoaded', () => {
  const loginButton = document.getElementById('login-btn'); // Remplace par l'ID réel de ton bouton
  const usernameInput = document.getElementById('username'); // Remplace par l'ID de ton champ texte pseudo

  if (loginButton) {
    loginButton.addEventListener('click', () => {
      const username = usernameInput ? usernameInput.value.trim() : '';
      
      if (username) {
        console.log('Tentative de connexion avec le pseudo :', username);
        
        // Envoi d'un événement au serveur (par exemple 'user-login')
        socket.emit('user-login', username);
      } else {
        alert('Veuillez entrer un pseudo !');
      }
    });
  }

  // Écouter la réponse du serveur après la connexion
  socket.on('login-success', (data) => {
    console.log('Connexion réussie !', data);
    // Cache l'écran de connexion et affiche le jeu, par exemple :
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
  });
});
