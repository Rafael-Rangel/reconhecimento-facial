const API_URL = "https://projetofotografo.zapto.org/api";
let selectedImages = [];
let imageMap = {};
let isProcessing = false;
let isLoadingAlbums = false;

// Função genérica para requisições à API
async function apiRequest(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, options);
    if (!response.ok) {
      throw new Error(`Erro na API: ${response.status} - ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Erro na requisição para ${endpoint}:`, error);
    throw error;
  }
}

// Debounce para evitar múltiplas chamadas simultâneas
function debounce(func, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
}

// Carrega álbuns com otimização e define as capas
async function loadAlbums() {
  if (isLoadingAlbums) return;
  isLoadingAlbums = true;

  const albumContainer = document.getElementById("album-container");
  if (!albumContainer) return;

  albumContainer.innerHTML = '<div class="loader"></div>';

  try {
    // Busca a lista de álbuns
    const data = await apiRequest("/main/folders");
    console.log("Álbuns retornados pela API:", data.folders);

    if (!Array.isArray(data.folders) || data.folders.length === 0) {
      albumContainer.innerHTML = "<p>Nenhum álbum disponível.</p>";
      return;
    }

    // Filtra o álbum FotosCapas para que ele não seja exibido
    const filteredAlbums = data.folders.filter(album => album.name.trim().toLowerCase() !== "fotoscapas");
    console.log("Álbuns filtrados (sem FotosCapas):", filteredAlbums);

    // Busca as imagens do álbum FotosCapas
    const fotosCapasData = await apiRequest("/albums/1w3_3QJ0AMf-K6wqNHJPw4d5aWDekHTvN/images");
    const fotosCapas = fotosCapasData.images || [];
    console.log("Imagens retornadas do álbum FotosCapas:", fotosCapas);

    const fragment = document.createDocumentFragment();
    filteredAlbums.forEach(album => {
      console.log(`Processando álbum: ${album.name}`);

      // Cria os cartões dos álbuns
      const albumCard = document.createElement("div");
      albumCard.classList.add("album-card");

      // Busca a imagem de capa correspondente no álbum FotosCapas
      const fotoCapa = fotosCapas.find(img => {
        const lowerAlbumName = album.name.trim().toLowerCase();
        const lowerImageName = img.name.trim().toLowerCase().replace(/\.(jpg|jpeg|png)$/, ""); // Remove a extensão
        console.log(`Comparando álbum "${lowerAlbumName}" com imagem "${lowerImageName}"`);
        return lowerAlbumName === lowerImageName;
      });

      // Log para verificar qual imagem foi associada ao álbum
      if (fotoCapa) {
        console.log(`Imagem encontrada para o álbum "${album.name}":`, fotoCapa);
      } else {
        console.log(`Nenhuma imagem encontrada para o álbum "${album.name}".`);
      }

      // Define a URL da capa ou usa uma imagem padrão
      const capaUrl = fotoCapa
        ? `https://drive.google.com/thumbnail?id=${fotoCapa.id}`
        : "https://drive.google.com/thumbnail?id=1SILE8Ub-yNOXgxHXSfCAXLzEPS2EaMmx";

      albumCard.innerHTML = `
        <img 
          src="${capaUrl}" 
          alt="Capa do Álbum" 
          style="border-radius: 5px; width: 100%; height: 200px; object-fit: cover; transition: transform 0.3s; transform: scale(1.05);"
        >
        <h3>${album.name}</h3>
      `;
      albumCard.onclick = () => window.location.href = `album.html?album=${album.id}`;
      fragment.appendChild(albumCard);
    });

    albumContainer.innerHTML = "";
    albumContainer.appendChild(fragment);
  } catch (error) {
    console.error("Erro ao carregar os álbuns:", error);
    albumContainer.innerHTML = "<p>Erro ao carregar os álbuns. Tente novamente mais tarde.</p>";
  } finally {
    isLoadingAlbums = false;
  }
}

// Carrega as imagens do álbum FotosCapas e exibe no console
async function loadFotosCapas() {
  try {
    // ID do álbum FotosCapas
    const albumId = "1w3_3QJ0AMf-K6wqNHJPw4d5aWDekHTvN";

    // Faz a requisição para buscar as imagens do álbum FotosCapas
    const fotosCapasData = await apiRequest(`/albums/${albumId}/images`);
    const fotosCapas = fotosCapasData.images || [];

    // Verifica se as imagens foram retornadas
    if (fotosCapas.length === 0) {
      console.log("Nenhuma imagem encontrada no álbum FotosCapas.");
      return;
    }

    // Exibe todas as imagens retornadas no console
    console.log("Imagens retornadas do álbum FotosCapas:");
    fotosCapas.forEach(img => {
      console.log(`Imagem: ${img.name}, ID: ${img.id}, URL: ${img.url}`);
    });
  } catch (error) {
    console.error("Erro ao carregar as imagens do álbum FotosCapas:", error);
  }
}

// Atualiza o álbum com otimização
async function refreshAlbum(albumId) {
  if (isProcessing) return;
  isProcessing = true;

  const gallery = document.getElementById("image-gallery");
  if (!gallery) return;

  gallery.innerHTML = '<div class="loader"></div>';

  try {
    const data = await apiRequest(`/albums/${albumId}/images`);
    if (!Array.isArray(data.images) || data.images.length === 0) {
      gallery.innerHTML = "<p>Nenhuma imagem disponível.</p>";
      return;
    }

    const fragment = document.createDocumentFragment();
    data.images.forEach(image => {
      const container = document.createElement("div");
      container.classList.add("photo-container");
      container.innerHTML = `
        <img src="https://drive.google.com/thumbnail?id=${image.id}" alt="${image.name}" class="fade-in">
        <div class="selection-circle"></div>
      `;
      container.onclick = () => toggleImageSelection(container, image.id);
      fragment.appendChild(container);
    });

    gallery.innerHTML = "";
    gallery.appendChild(fragment);
  } catch (error) {
    gallery.innerHTML = "<p>Erro ao carregar as imagens. Tente novamente mais tarde.</p>";
  } finally {
    isProcessing = false;
  }
}

// Alterna a seleção de imagens
function toggleImageSelection(container, imageId) {
  container.classList.toggle("selected");
  if (container.classList.contains("selected")) {
    selectedImages.push(imageId);
  } else {
    selectedImages = selectedImages.filter(id => id !== imageId);
  }
}

// Envia selfie para comparação
async function uploadSelfie() {
  const fileInput = document.getElementById("fileInput");
  const cameraInput = document.getElementById("cameraInput");
  const file = cameraInput?.files[0] || fileInput?.files[0];

  if (!file) {
    alert("Selecione uma imagem para enviar.");
    return;
  }

  const albumId = new URLSearchParams(window.location.search).get("album");
  if (!albumId) {
    console.error("Nenhum albumId encontrado!");
    return;
  }

  const gallery = document.getElementById("image-gallery");
  gallery.innerHTML = '<div class="loader"></div>';

  try {
    const formData = new FormData();
    formData.append("file", file);

    const data = await apiRequest(`/albums/${albumId}/upload-selfie?max_faces=4096&threshold=70`, {
      method: "POST",
      body: formData
    });

    if (!data.matches || data.matches.length === 0) {
      gallery.innerHTML = "<p>Nenhuma correspondência encontrada.</p>";
      return;
    }

    displayMatchingImages(data.matches);
  } catch (error) {
    gallery.innerHTML = "<p>Erro ao processar sua imagem. Tente novamente mais tarde.</p>";
  }
}

// Exibe imagens correspondentes
function displayMatchingImages(matches) {
  const gallery = document.getElementById("image-gallery");
  if (!gallery) return;

  const fragment = document.createDocumentFragment();
  matches.forEach(match => {
    const img = document.createElement("img");
    img.src = `https://drive.google.com/thumbnail?id=${match.image_id}`;
    img.alt = "";
    img.classList.add("fade-in");
    img.onclick = () => window.open(`https://drive.google.com/uc?id=${match.image_id}&export=download`, "_blank");
    fragment.appendChild(img);
  });

  gallery.innerHTML = "";
  gallery.appendChild(fragment);
}

// Inicializa eventos e carregamento
document.addEventListener("DOMContentLoaded", () => {
  const albumId = new URLSearchParams(window.location.search).get("album");
  if (albumId) {
    refreshAlbum(albumId);
  } else {
    loadAlbums();
  }

  // Apenas lista as imagens do álbum FotosCapas no console
  loadFotosCapas();

  document.getElementById("updateAlbumsBtn")?.addEventListener("click", debounce(loadAlbums, 300));
  document.getElementById("updateAlbumBtn")?.addEventListener("click", debounce(() => refreshAlbum(albumId), 300));
});

// Expõe funções globalmente
window.loadAlbums = loadAlbums;
window.refreshAlbum = refreshAlbum;
window.uploadSelfie = uploadSelfie;
window.loadFotosCapas = loadFotosCapas;
