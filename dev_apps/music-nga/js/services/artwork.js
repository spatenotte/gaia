importScripts('components/bridge/client.js');

var client = bridge.client({
  service: 'music-service',
  endpoint: new BroadcastChannel('music-service')
});

function ArtworkService(worker) {
  var stopAfter = ServiceWorkerWare.decorators.stopAfter;

  worker.get('/api/artwork/original/:filePath', stopAfter((request) => {
    return new Promise((resolve) => {
      var filePath = '/' + decodeURIComponent(request.parameters.filePath);
      client.method('getSongArtwork', filePath)
        .then((file) => {
          resolve(new Response(file, {
            headers: { 'Content-Type': file.type || 'application/octet-stream' }
          }));
        })
        .catch((error) => {
          resolve(new Response('', { status: 404 }));
        });
    });
  }));

  worker.get('/api/artwork/thumbnail/:filePath', stopAfter((request) => {
    return new Promise((resolve) => {
      var filePath = '/' + decodeURIComponent(request.parameters.filePath);
      client.method('getSongThumbnail', filePath)
        .then((file) => {
          resolve(new Response(file, {
            headers: { 'Content-Type': file.type || 'application/octet-stream' }
          }));
        })
        .catch((error) => {
          resolve(new Response('', { status: 404 }));
        });
    });
  }));
}
