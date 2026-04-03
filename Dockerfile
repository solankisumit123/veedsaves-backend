# Base Image (Debian based taaki ffmpeg aur yt-dlp install ho sakein)
FROM node:18-slim

# Working Directory set karein
WORKDIR /app

# System dependencies install karein (ffmpeg, curl, python3)
# Note: yt-dlp ke liye python3 chahiye hota hai
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    && rm -rf /var/lib/apt/lists/*

# yt-dlp install karein (latest version ke liye)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

# package.json copy karein aur dependencies install karein
COPY package*.json ./
RUN npm install --production

# Pura backend code copy karein
COPY . .

# Downloads folder create karein (permissions ke saath)
RUN mkdir -p downloads && chmod 777 downloads

# App ko 3001 port par expose karein
EXPOSE 3001

# Application start karein
CMD ["npm", "start"]
