const API_URL = "https://projetofotografo.zapto.org/api";
let selectedImages = [];
let imageMap = {};
let isProcessing = false;
let isLoadingAlbums = false;
let currentPageToken = null; // Token da página atual
let hasMoreImages = true; // Indica se há mais imagens para carregar

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
  if (!albumContainer) {
    console.error("Elemento 'album-container' não encontrado no DOM.");
    return;
  }

  albumContainer.innerHTML = '<div class="loader"></div>'; // Exibe um loader enquanto carrega

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

    // Processa as imagens do álbum FotosCapas
    let fotosCapas = [];
    try {
      const processResponse = await apiRequest("/albums/1w3_3QJ0AMf-K6wqNHJPw4d5aWDekHTvN/process-images", {
        method: "POST",
      });
      fotosCapas = processResponse.images || [];
      console.log("Imagens processadas do álbum FotosCapas:", fotosCapas);
    } catch (error) {
      console.error("Erro ao processar imagens do álbum FotosCapas:", error);
      // Continua sem as imagens de capa
    }

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

      // Define a URL da capa ou usa uma imagem padrão
      const capaUrl = fotoCapa
        ? `https://drive.google.com/thumbnail?id=${fotoCapa.id}`
        : "https://placehold.co/300x200?text=Sem+Capa"; // Placeholder padrão

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

    albumContainer.innerHTML = ""; // Limpa o container
    albumContainer.appendChild(fragment); // Adiciona os álbuns ao DOM
  } catch (error) {
    console.error("Erro ao carregar os álbuns:", error);
    albumContainer.innerHTML = "<p>Erro ao carregar os álbuns. Tente novamente mais tarde.</p>";
  } finally {
    isLoadingAlbums = false;
  }
}


// Atualiza o álbum com otimização
async function refreshAlbum(albumId) {
  const gallery = document.getElementById("image-gallery");
  if (!gallery) {
    console.error("Elemento 'image-gallery' não encontrado.");
    return;
  }

  // Mostra o loader enquanto carrega todas as imagens
  gallery.innerHTML = '<div class="loader"></div>';

  try {
    // Faz a requisição única pra pegar todas as imagens usando page_size=999
    const endpoint = `/albums/${albumId}/process-images?page_size=999`;
    const data = await apiRequest(endpoint, { method: "POST" });

    // Verifica se a resposta trouxe imagens
    if (!Array.isArray(data.images) || data.images.length === 0) {
      gallery.innerHTML = "<p>Nenhuma imagem disponível.</p>";
      return;
    }

    // Cria os elementos das imagens e adiciona no DOM
    const fragment = document.createDocumentFragment();
    data.images.forEach(image => {
      const container = document.createElement("div");
      container.classList.add("photo-container");
      container.innerHTML = `
          <img src="https://drive.google.com/thumbnail?id=${image.id}" alt="${image.name}" class="fade-in">
        <div class="selection-circle"></div>
      `;
      fragment.appendChild(container);
    });

    gallery.innerHTML = "";
    gallery.appendChild(fragment);
    console.log("Imagens carregadas:", data.images.length);
  } catch (error) {
    console.error("Erro ao carregar as imagens:", error);
    gallery.innerHTML = "<p>Erro ao carregar as imagens. Tente novamente mais tarde.</p>";
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

  // Função que envia selfie pra reconhecimento facial
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

    // Chama a API de reconhecimento facial
    const data = await apiRequest(`/albums/${albumId}/recognize-face`, {
      method: "POST",
      body: formData,
    });

    if (!data.matches || data.matches.length === 0) {
      gallery.innerHTML = "<p>Nenhuma correspondência encontrada.</p>";
      return;
    }

    displayMatchingImages(data.matches);
  } catch (error) {
    console.error("Erro ao processar sua imagem:", error);
    gallery.innerHTML = "<p>Erro ao processar sua imagem. Tente novamente mais tarde.</p>";
  }
}

// Exibe imagens correspondentes
function displayMatchingImages(matches) {
  const gallery = document.getElementById("image-gallery");
  if (!gallery) return;

  const fragment = document.createDocumentFragment();
  matches.forEach(match => {
    const container = document.createElement("div");
    container.classList.add("photo-container");

    container.innerHTML = `
      <a href="https://drive.google.com/uc?id=${match.image_id}&export=download" download="">
        <img src="https://drive.google.com/thumbnail?id=${match.image_id}" alt="" class="fade-in">
      </a>
      <div class="selection-circle"></div>
    `;
    fragment.appendChild(container);
  });

  gallery.innerHTML = "";
  gallery.appendChild(fragment);
}

// Desleciona todas as fotos
document.getElementById("deselect-all-btn").addEventListener("click", () => { 
  const containers = document.querySelectorAll(".photo-container");
  selectedImages = [];
  containers.forEach(container => {
    // Remove a classe "selected" de cada container, se estiver presente
    container.classList.remove("selected");
  });
  console.log("Todas desmarcadas:", selectedImages);
});

// Seleciona todas as fotos
document.getElementById("select-all-btn").addEventListener("click", () => {
  const containers = document.querySelectorAll(".photo-container");
  selectedImages = [];
  containers.forEach(container => {
    if (!container.classList.contains("selected")) {
      container.classList.add("selected");
      // Obtenha o ID da imagem
      const img = container.querySelector("img");
      const url = img.src;
      const idMatch = url.match(/id=([^&]+)/);
      if (idMatch) {
        selectedImages.push(idMatch[1]);
      }
    }
  });
  console.log("Selecionadas todas:", selectedImages);
});

// Baixa as fotos selecionadas em um ZIP
document.getElementById("download-selected-btn").addEventListener("click", () => {
  if (selectedImages.length === 0) {
    alert("Nenhuma imagem selecionada!");
    return;
  }
  downloadSelectedImages(selectedImages);
});

// Função para baixar imagens selecionadas e criar o ZIP
async function downloadSelectedImages(selectedIds) {
  const zip = new JSZip();
  const imgFolder = zip.folder("imagens");

  for (let i = 0; i < selectedIds.length; i++) {
    const id = selectedIds[i];
    const driveUrl = `https://drive.google.com/uc?id=${id}&export=download`;
    const proxyUrl = `https://reconhecimento-facial-kappa.vercel.app/proxy?url=${encodeURIComponent(driveUrl)}`;
    
    try {
      const response = await fetch(proxyUrl);
      const blob = await response.blob();
      const fileName = `imagem_${i + 1}.jpg`;
      imgFolder.file(fileName, blob);
    } catch (error) {
      console.error("Erro ao baixar a imagem:", driveUrl, error);
    }
  }

  zip.generateAsync({ type: "blob" }).then(function(content) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(content);
    a.download = "imagens.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });
}

// Adiciona evento de clique para a seleção ou download
document.addEventListener("click", (event) => {
  console.log("Elemento clicado:", event.target); // Loga o elemento clicado

  // Clique no círculo de seleção
  if (event.target.classList.contains("selection-circle")) {
    console.log("Círculo de seleção clicado.");
    const photoContainer = event.target.closest(".photo-container");
    if (photoContainer) {
      toggleSelection(photoContainer); // Alterna a seleção
    }
    return; // Sai da função para evitar conflitos
  }

  // Clique na imagem
  if (event.target.tagName === "IMG" && event.target.closest(".photo-container")) {
    console.log("Imagem clicada para download:", event.target.src);
    event.stopPropagation(); // Impede que o clique na imagem afete o contêiner pai
    downloadImage(event.target); // Baixa a imagem
    return; // Sai da função para evitar conflitos
  }

  console.log("Nenhuma ação definida para este clique.");
});

// Função para alternar a seleção de uma imagem
function toggleSelection(photoContainer) {
  photoContainer.classList.toggle("selected");
  console.log("Classe 'selected' alternada no contêiner:", photoContainer);

  // Atualiza o array de imagens selecionadas
  const img = photoContainer.querySelector("img");
  const url = img.src;
  const idMatch = url.match(/id=([^&]+)/);

  if (idMatch) {
    const imageId = idMatch[1];
    if (photoContainer.classList.contains("selected")) {
      if (!selectedImages.includes(imageId)) {
        selectedImages.push(imageId);
        console.log("Imagem adicionada à seleção:", imageId);
      }
    } else {
      selectedImages = selectedImages.filter(id => id !== imageId);
      console.log("Imagem removida da seleção:", imageId);
    }
  }

  console.log("Estado atual das imagens selecionadas:", selectedImages);
}

// Função para baixar uma imagem
async function downloadImage(img) {
  const url = img.src;
  const idMatch = url.match(/id=([^&]+)/);
  if (!idMatch) {
    console.log("Erro: ID da imagem não encontrado na URL:", url);
    return;
  }
  const imageId = idMatch[1];
  // URL original do drive
  const driveUrl = `https://drive.google.com/uc?id=${imageId}&export=download`;
  // Usando proxy pra evitar bloqueio de CORS
  const proxyUrl = `https://reconhecimento-facial-kappa.vercel.app/proxy?url=${encodeURIComponent(driveUrl)}`;

  // Seleciona o contêiner da imagem e seta o estilo de "carregando"
  const container = img.closest(".photo-container");
  if (container) {
    // Aplica o estilo exato no container para o modo carregando
    container.style.display = "flex";
    container.style.justifyContent = "center";
    container.style.alignItems = "center";

    // Verifica se já tem loader; se não, adiciona o loader exato
    if (!container.querySelector(".loader")) {
      const loader = document.createElement("div");
      loader.className = "loader";
      loader.setAttribute("style", "position: absolute;z-index: 9;");
      container.insertBefore(loader, container.firstChild);
    }
    // Define o filtro da imagem para 61%
    img.setAttribute("style", "filter: brightness( 61% );");
  }

  try {
    // Tenta baixar a imagem via fetch usando o proxy
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error("Erro no download!");
    const blob = await response.blob();

    // Cria um link temporário e dispara o download
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = img.alt || "imagem.jpg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    console.log("Download concluído para a imagem:", imageId);
  } catch (error) {
    console.error("Erro durante o download:", error);
  } finally {
    // Remove o loader e restaura o modo padrão exato
    if (container) {
      const loaderElem = container.querySelector(".loader");
      if (loaderElem) loaderElem.remove();
      // Remove os estilos inline para voltar ao padrão (default não terá inline)
      container.removeAttribute("style");
    }
    img.removeAttribute("style");
  }
}



// Inicializa eventos e carregamento
document.addEventListener("DOMContentLoaded", function () {
  const albumId = new URLSearchParams(window.location.search).get("album");

  if (albumId) {
    console.log("🚀 Página carregada dentro de um álbum, tentando atualizar...");
    refreshAlbum(albumId, true); // Primeira carga
  }

  // Adiciona o evento de clique ao botão "Atualizar Álbum"
  const updateButton = document.getElementById("updateAlbumBtn");
  if (updateButton) {
    updateButton.addEventListener("click", () => {
      console.log("🔄 Botão 'Atualizar Álbum' clicado!");
      refreshAlbum(albumId, true); // Atualiza o álbum
    });
  }
});


// Expõe funções globalmente
window.loadAlbums = loadAlbums;
window.refreshAlbum = refreshAlbum;
window.uploadSelfie = uploadSelfie;
