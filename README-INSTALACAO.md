# Decor Colors — Quartzo Mica | Showroom 3D

## 1. Estrutura necessária

Crie uma pasta chamada `decor-colors-quartzo-mica` e coloque os arquivos do projeto dentro dela:

```text
decor-colors-quartzo-mica/
├─ index.html
├─ style.css
├─ app.js
├─ catalogo.json
├─ README-INSTALACAO.md
├─ assets/
│  ├─ mockups/
│  └─ textures/
└─ uploads/
   ├─ mockups/
   ├─ models/
   ├─ textures/
   └─ usdz/
```

## 2. Copie os JPEGs recebidos

Renomeie e copie os arquivos para estas localizações exatas:

```text
Minerio.jpg                   → assets/textures/minerio.jpg
Topazio-4.jpg                 → assets/mockups/topazio.jpg
Topazio-4.jpg                 → assets/textures/topazio.jpg
Off-White-7.jpg               → assets/mockups/off-white.jpg
Off-White-7.jpg               → assets/textures/off-white.jpg
Bianco-8.jpg                  → assets/mockups/bianco.jpg
Bianco-8.jpg                  → assets/textures/bianco.jpg
Olho-de-Tigre-3.jpg           → assets/mockups/olho-de-tigre.jpg
Olho-de-Tigre-3.jpg           → assets/textures/olho-de-tigre.jpg
Onix-6.jpg                    → assets/mockups/onix.jpg
Onix-6.jpg                    → assets/textures/onix.jpg
Jaspe-5.jpg                   → assets/mockups/jaspe.jpg
Jaspe-5.jpg                   → assets/textures/jaspe.jpg
Quartzo-Mica-Piso-8.jpg       → assets/textures/quartzo-mica-piso.jpg
Quartzo-Mica-Parede-9.jpg     → assets/textures/quartzo-mica-parede.jpg
```

No início, o mesmo JPEG de cada produto pode servir como mockup e textura de demonstração. Depois, substitua apenas os arquivos de `assets/textures/` por texturas **seamless** reais, mantendo os mesmos nomes.

## 3. Rodar localmente

No PowerShell, dentro da pasta do projeto:

```powershell
python -m http.server 5500
```

Abra:

```text
http://127.0.0.1:5500
```

Para disponibilizar HTTPS e testar AR em dispositivo compatível:

```powershell
cloudflared tunnel --url http://127.0.0.1:5500 --protocol http2
```

## 4. Pasta uploads

A pasta `uploads/` é reservada para seus arquivos substituíveis:

```text
uploads/models/       → arquivos .glb novos
uploads/usdz/         → arquivos .usdz para iPhone/iPad
uploads/textures/     → novas texturas enviadas pelo cliente
uploads/mockups/      → novas imagens de produto
```

O showroom possui upload temporário de imagem durante a navegação. Essa imagem não é enviada a um servidor: ela fica somente no navegador do cliente até recarregar a página.

## 5. Modelos 3D futuros

Quando tiver um modelo real, coloque-o em:

```text
uploads/models/quartzo-mica.glb
```

Para iPhone/iPad, coloque a versão USDZ correspondente em:

```text
uploads/usdz/quartzo-mica.usdz
```

A próxima etapa será conectar esses modelos aos botões de produto e AR. Mantenha o arquivo `.blend` original separado; `.glb` é a versão otimizada para web.

## 6. AR e VR

- O botão AR usa WebXR quando o aparelho/navegador oferece suporte.
- O modo AR começa com uma mira no chão e exige confirmação antes de colocar a maquete.
- Depois de posicionar, use os botões para mover, centralizar e redimensionar.
- O modo VR depende de um headset e navegador compatível.
- Para AR/VR, use sempre URL HTTPS (Cloudflare Tunnel, Cloudflare Pages ou hospedagem HTTPS).
