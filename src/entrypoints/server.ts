import WebSocket from 'ws';
import {logger} from "../logger";
import {Service, ServiceEvent} from "../services/service";
import {getHomepage} from "../services/homepage";

const port = 8080;
const wss = new WebSocket.Server({ port });

const service = new Service();
service.run();

wss.on("listening", () => {
  logger.info(`WebSocket server listening on ${port}`)
})

wss.on('connection', function connection(ws) {
  logger.info(`new connection`);
  ws.send(JSON.stringify(getHomepage()))
  service.on(ServiceEvent.DataReloaded, () => {
    ws.send(JSON.stringify(getHomepage()))
  })
});

process.on('uncaughtException', function (err) {
  logger.error(err)
  console.log(err)
});
