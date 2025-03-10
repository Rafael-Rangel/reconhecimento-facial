//const API_URL = "https://cors-anywhere.herokuapp.com/http://3.12.76.155:8000/api";
const API_URL = "https://projetofotografo.zapto.org/api";
// autorização 1hr: https://cors-anywhere.herokuapp.com/corsdemo
let selectedImages = []; // Armazena os IDs ou URLs das imagens selecionadas

let imageMap = {}; // Mapeamento ID -> Nome da imagem
let isProcessing = false; // Evita chamadas duplicadas no álbum
let isLoadingAlbums = false; // Evita múltiplas chamadas ao carregar álbuns

// Verifica se o álbum existe antes de carregar
async function checkAndLoadAlbum(albumId) {
    if (!albumId) {
        console.warn("⚠️ Nenhum albumId fornecido!");
        alert("Álbum inválido! Retornando à página inicial.");
        window.location.href = "index.html";
        return;
    }

    try {
        console.log(`Verificando existência do álbum: ${albumId}...`);
        const response = await fetch(`${API_URL}/albums/${albumId}`);

        if (!response.ok) {
                console.warn(`ALERTA: Álbum não encontrado! Código: ${response.status}`);

            if (response.status === 404) {
                alert("Este álbum não existe ou foi excluído!");
                window.location.href = "index.html"; // Redireciona para a página principal
                return;
            }

                throw new Error(`Erro ao verificar álbum (Status: ${response.status})`);
        }

        console.log("Álbum encontrado! Carregando imagens...");
        refreshAlbum(albumId); // Agora podemos carregar as imagens com segurança

    } catch (error) {
        console.error("Erro ao verificar o álbum:", error);
        alert("Erro ao verificar álbum. Tente novamente mais tarde.");
        window.location.href = "index.html";
    }
}

// Atualiza e carrega imagens corretamente, com verificação se o álbum existe
let isAlbumDeleted = false; // Flag para evitar loop infinito

async function refreshAlbum(albumId, forceUpdate = false) {
    if (isProcessing && !forceUpdate) {
        console.warn("⚠️ Já está processando! Ignorando nova chamada.");
        return;
    }
    if (isAlbumDeleted) {
        console.warn("ALERTA: O álbum foi excluído. Não faremos novas tentativas.");
        return;
    }

    isProcessing = true;

    try {
        console.log("Iniciando refreshAlbum para albumId:", albumId);
        if (!albumId) {
            console.warn("⚠️ Nenhum albumId encontrado na URL!");
            return;
        }

        const gallery = document.getElementById("image-gallery");
        if (!gallery) {
            console.warn("⚠️ Elemento #image-gallery não encontrado!");
            return;
        }
        // Mostra o loader
        gallery.classList.add("loading");
        gallery.innerHTML = '<div class="loader"></div>';

        // Verifica primeiro se o álbum existe
       let response = await fetch(`${API_URL}/albums/${albumId}/images`);


        if (!response.ok) {
            console.warn("ALERTA: O álbum não existe ou foi excluído! Código:", response.status);

            if (response.status === 404) {
                isAlbumDeleted = true; // Marca que o álbum foi excluído

               gallery.innerHTML = `<p style="color: #e01f34; width: 100vw; text-align: center;">Este álbum foi excluído ou não existe.</p>`;

                setTimeout(() => {
                    window.location.href = "index.html"; // Redireciona para a página inicial
                }, 3000);

                return;
            }

            throw new Error(`Erro ao carregar álbum (Status: ${response.status})`);

        } 

        let data = await response.json();

        if (Array.isArray(data.images) && data.images.length > 0) {
            console.log("Imagens carregadas com sucesso!");
            displayImages(data.images);
        } else {
            console.warn("⚠️ Nenhuma imagem encontrada.");
            gallery.innerHTML = "<p style='color: #e01f34; width: 100vw; text-align: center;'>Nenhuma imagem disponível.</p>";
        }
    } catch (error) {
        console.error("Erro ao atualizar o álbum:", error);
        const gallery = document.getElementById("image-gallery");
        if (gallery) {
            gallery.innerHTML = "<p style='color: #e01f34; width: 100vw; text-align: center;'>Erro ao carregar as imagens. Tente novamente mais tarde.</p>";
        }
    } finally {
        isProcessing = false;
        const gallery = document.getElementById("image-gallery");
        if (gallery) gallery.classList.remove("loading");
    }
}

// Inicia o carregamento ao abrir a página com verificação se o álbum existe
document.addEventListener("DOMContentLoaded", () => {
    const albumId = new URLSearchParams(window.location.search).get("album");

    if (!albumId) {
        console.log("Carregando lista de álbuns...");
        loadAlbums();
    } else {
        console.log("Página carregada dentro de um álbum, verificando existência...");

        if (!isProcessing) {
            isProcessing = true;
        } else {
            console.warn("⚠️ Ignorando chamada duplicada de refreshAlbum.");
        }
    }
});

// Exibe imagens conforme forem carregando
function displayImages(images) {
  const gallery = document.getElementById("image-gallery");
  if (!gallery) return;

  gallery.innerHTML = ""; // Limpa a galeria
  imageMap = {};
  selectedImages = []; // Reseta as seleções

  images.forEach(image => {
    imageMap[image.id] = image.name;

    // Cria o container
    const container = document.createElement("div");
    container.classList.add("photo-container");

    // Cria a imagem
    const img = document.createElement("img");
    img.src = `https://drive.google.com/thumbnail?id=${image.id}`;
    img.alt = image.name;
    img.loading = "lazy";  // Lazy load
    img.classList.add("fade-in");

    // Evento para quando a imagem for carregada
    img.onload = () => {
      // Verifica se todas as imagens foram carregadas, se sim, remove o loader
      checkAndRemoveLoader(); 
    };

    // Clique duplo para abrir a imagem
    img.onclick = () => window.open(image.url, "_blank");

    // Cria a bolinha de seleção
    const circle = document.createElement("div");
    circle.classList.add("selection-circle");
    // Ao clicar no container, alterna a seleção
    container.onclick = (e) => {
      if (e.target !== container && !e.target.classList.contains("selection-circle")) return;

      container.classList.toggle("selected");
      const isSelected = container.classList.contains("selected");
      if (isSelected) {
        selectedImages.push(image.id);
      } else {
        selectedImages = selectedImages.filter(id => id !== image.id);
      }
    };

    container.appendChild(img);
    container.appendChild(circle);
    gallery.appendChild(container);
  });

  console.log("Imagens carregadas com sucesso!");
}


// Envia selfie e busca rostos similares
async function uploadSelfie() {
    // Pega os inputs
    const fileInput = document.getElementById("fileInput");
    const cameraInput = document.getElementById("cameraInput");

    let file = null;

    // Verifica se o input da câmera tem arquivo
    if (cameraInput && cameraInput.files && cameraInput.files.length > 0) {
        file = cameraInput.files[0];
    }
    // Se não, verifica o input do arquivo
    else if (fileInput && fileInput.files && fileInput.files.length > 0) {
        file = fileInput.files[0];
    }

    if (!file) {
        alert("Selecione uma imagem para enviar.");
        return;
    }

    const albumId = new URLSearchParams(window.location.search).get("album");
    if (!albumId) {
        console.error("⚠️ Nenhum albumId encontrado!");
        return;
    }

    // Mostra o loader e remove as fotos atuais
    const gallery = document.getElementById("image-gallery");
    if (gallery) {
        gallery.innerHTML = '<div class="loader"></div>';
    }

    try {
        console.log("Enviando selfie para comparação...");
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`${API_URL}/albums/${albumId}/upload-selfie?max_faces=5&threshold=70`, {
            method: "POST",
            body: formData
        });


        if (!response.ok) {
            console.error("Erro ao enviar selfie:", response.status);
            alert("Erro ao enviar selfie. Tente novamente.");
            if (gallery) gallery.innerHTML = "";
            return;
        }

        const data = await response.json();
        console.log("Resultado da API:", data);

        if (!data.matches || data.matches.length === 0) {
            console.warn("⚠️ Nenhuma imagem similar encontrada.");
            if (gallery) gallery.innerHTML = "<p style='color: #e01f34; width: 100vw; text-align: center;'>Nenhuma correspondência encontrada.</p>";
            return;
        }

        displayMatchingImages(data.matches);
    } catch (error) {
        console.error("Erro ao enviar selfie:", error);
        if (gallery) gallery.innerHTML = "<p style=' color: #e01f34; width: 100vw; text-align: center;'>Erro ao processar sua imagem. Tente novamente mais tarde.</p>";
    }
}


// Exibe os rostos mais similares encontrados
function displayMatchingImages(matches) {
  const gallery = document.getElementById("image-gallery");
  if (!gallery) return;

  gallery.innerHTML = ""; // Limpa a galeria
  imageMap = {}; // Resetando o mapa de imagens
  selectedImages = []; // Resetando as imagens selecionadas

  if (!Array.isArray(matches) || matches.length === 0) {
    console.warn("⚠️ Nenhuma imagem similar encontrada.");
    gallery.innerHTML = "<p>Nenhuma imagem correspondente.</p>";
    return;
  }

  matches.forEach(match => {
    const img = document.createElement("img");
    img.src = `https://drive.google.com/thumbnail?id=${match.image_id}`;
    img.alt = ""; // Sem texto de similaridade
    img.loading = "lazy";  // Lazy load
    img.classList.add("fade-in");

    // Evento para quando a imagem for carregada
    img.onload = () => {
      checkAndRemoveLoader(); // Remove o loader quando a imagem carregar
    };

    img.onclick = () => window.open(`https://drive.google.com/uc?id=${match.image_id}&export=download`, "_blank");

    gallery.appendChild(img);
  });

  console.log("Imagens similares carregadas!");
}



function checkAndRemoveLoader() {
  const gallery = document.getElementById("image-gallery");
  const loader = gallery.querySelector(".loader");

  // Verifica se há ao menos uma imagem carregada
  const img = gallery.querySelector("img");

  if (img) {
    if (loader) {
      loader.style.display = "none"; // Remove o loader
    }
  }
}


// Carrega os álbuns apenas se não estiver sendo carregado
async function loadAlbums() {
  if (isLoadingAlbums) {
    console.warn("⚠️ Já está carregando os álbuns! Ignorando nova chamada.");
    return;
  }
  isLoadingAlbums = true;

  const albumContainer = document.getElementById("album-container");
  if (!albumContainer) {
    console.warn("⚠️ Página sem #album-container, pulando carregamento de álbuns.");
    return;
  }

  // Mostra o loader inicialmente
  albumContainer.classList.add("loading");
  albumContainer.innerHTML = '<div class="loader"></div>';

  try {
    console.log("Buscando álbuns...");
    const response = await fetch(`${API_URL}/main/folders`);

    if (!response.ok) {
      console.warn(`ALERTA: Erro na API: ${response.status}`);
      throw new Error("Erro ao carregar álbuns.");
    }

    const data = await response.json();
    console.log("Álbuns recebidos:", data);

    if (!Array.isArray(data.folders) || data.folders.length === 0) {
      console.warn("⚠️ Nenhum álbum encontrado!");
      albumContainer.innerHTML = "<p style='width: 100vw; text-align: center;'>Nenhum álbum disponível.</p>";
      return;
    }

    let firstAlbumLoaded = false; // Variável para controlar quando o primeiro álbum foi exibido

    // Para cada álbum, cria um card e puxa apenas a foto "FotoCapa"
    for (const album of data.folders) {
      const albumCard = document.createElement("div");
      albumCard.classList.add("album-card");

      const title = document.createElement("h3");
      title.innerText = album.name;

      const coverImg = document.createElement("img");
      coverImg.style.borderRadius = "5px";
      coverImg.style.width = "100%";
      coverImg.style.height = "200px";
      coverImg.style.objectFit = "cover";
      coverImg.style.transition = "transform 0.3s ease";
      coverImg.alt = "Capa do Álbum";

      coverImg.addEventListener("mouseenter", () => {
        coverImg.style.transform = "scale(1.05)";
      });

      coverImg.addEventListener("mouseleave", () => {
        coverImg.style.transform = "scale(1)";
      });

      // Busca as imagens do álbum
      try {
        const resImages = await fetch(`${API_URL}/albums/${album.id}/images`);
        if (!resImages.ok) {
          console.warn(`Erro ao buscar imagens do álbum ${album.id}`);
          throw new Error("Erro ao carregar imagens do álbum.");
        }

        const imagesData = await resImages.json();

        if (Array.isArray(imagesData.images)) {
          const fotoCapa = imagesData.images.find(img =>
            img.name.toLowerCase().startsWith("fotocapa")
          );

          if (fotoCapa) {
            coverImg.src = `https://drive.google.com/thumbnail?id=${fotoCapa.id}`;
          } else {
            coverImg.src = "https://placehold.co/300x200?text=Sem+Capa";
          }
        } else {
          coverImg.src = "https://placehold.co/300x200?text=Sem+Capa";
        }
      } catch (error) {
        coverImg.src = "https://placehold.co/300x200?text=Erro+Capa";
      }

      albumCard.onclick = () => {
        window.location.href = `album.html?album=${album.id}`;
      };

      albumCard.appendChild(coverImg);
      albumCard.appendChild(title);

      // Adiciona ao container
      albumContainer.appendChild(albumCard);

      /*/ Após o primeiro álbum ser carregado, remova o loader
      if (!firstAlbumLoaded) {
        firstAlbumLoaded = true;   Marca que o primeiro álbum foi carregado
        checkAndRemoveLoader();  // Chama a função para verificar e remover o loader
      }*/
    }

    console.log("Álbuns exibidos com capa!");
  } catch (error) {
    console.error("Erro ao carregar álbuns:", error);
    albumContainer.innerHTML = "<p style=' color: #e01f34; width: 100vw; text-align: center;'>Erro ao carregar os álbuns. Tente novamente mais tarde.</p>";
  } finally {
    isLoadingAlbums = false; // Resetando o estado após a conclusão
  }
}


// Inicia o carregamento ao abrir a página somente se for necessário
document.addEventListener("DOMContentLoaded", () => {
    const albumId = new URLSearchParams(window.location.search).get("album");

    if (!albumId) {
        console.log("Carregando lista de álbuns...");
        loadAlbums();
    } else {
        console.log("Página carregada dentro de um álbum, tentando atualizar...");
        refreshAlbum(albumId, true);
    }

    // Garante que o botão também funcione manualmente
    const updateAlbumsBtn = document.getElementById("updateAlbumsBtn");
    if (updateAlbumsBtn) {
        updateAlbumsBtn.addEventListener("click", () => loadAlbums());
    }

    const updateAlbumBtn = document.getElementById("updateAlbumBtn");
    if (updateAlbumBtn) {
        updateAlbumBtn.addEventListener("click", () => refreshAlbum(albumId, true));
    }
});

document.getElementById("select-all-btn").addEventListener("click", () => {
  const containers = document.querySelectorAll(".photo-container");
  selectedImages = [];
  containers.forEach(container => {
    if (!container.classList.contains("selected")) {
      container.classList.add("selected");
      // Obtenha o ID da imagem, assumindo que o ID está no src (ou de outra forma)
      const img = container.querySelector("img");
      // Exemplo: extraia o ID da URL do Google Drive
      const url = img.src;
      const idMatch = url.match(/id=([^&]+)/);
      if (idMatch) {
        selectedImages.push(idMatch[1]);
      }
    }
  });
  console.log("Selecionadas todas:", selectedImages);
});

document.getElementById("download-selected-btn").addEventListener("click", () => {
  if (selectedImages.length === 0) {
    alert("Nenhuma imagem selecionada!");
    return;
  }
  downloadSelectedImages(selectedImages);
});


async function downloadSelectedImages(selectedIds) {
  const zip = new JSZip();
  const imgFolder = zip.folder("imagens");

  for (let i = 0; i < selectedIds.length; i++) {
    const id = selectedIds[i];
    // Monta a URL original do Drive
    const driveUrl = `https://drive.google.com/uc?id=${id}&export=download`;
    // Monta a URL do proxy (substitua com o domínio real do seu proxy)
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

// Função para monitorar o container de álbuns (index.html)
// Assim que o primeiro "album-card" for adicionado, ela procura a div com a classe "loader"
// e zera sua classe, deixando a div intacta.
function monitorAlbumContainer() {
  const albumContainer = document.getElementById("album-container");
  if (!albumContainer) {
    console.log("album-container não encontrado!");
    return;
  }
  
  console.log("Monitorando album-container para a adição de album-card...");

  // Cria um MutationObserver para observar alterações nos filhos do container
  const observer = new MutationObserver((mutations, obs) => {
    mutations.forEach(mutation => {
      if (mutation.addedNodes.length > 0) {
        console.log("Novos nós adicionados:", mutation.addedNodes);
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains("album-card")) {
            console.log("album-card encontrado:", node);
            // Busca a div com a classe "loader" dentro do container
            const loaderDiv = albumContainer.querySelector(".loader");
            if (loaderDiv) {
              loaderDiv.className = ""; // Zera a classe
              console.log("Classe do loader zerada:", loaderDiv);
            } else {
              console.log("Loader não encontrado dentro do album-container.");
            }
            console.log("Desconectando o observador.");
            obs.disconnect();
          }
        });
      }
    });
  });

  observer.observe(albumContainer, { childList: true });
}


document.addEventListener("DOMContentLoaded", () => {
  monitorAlbumContainer();
  // ... demais códigos que já existem no DOMContentLoaded
});



// Expõe funções globalmente para evitar erro "loadAlbums is not defined"
window.loadAlbums = loadAlbums;
window.refreshAlbum = refreshAlbum;
window.uploadSelfie = uploadSelfie;
