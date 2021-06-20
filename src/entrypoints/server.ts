import WebSocket from 'ws';
import {logger} from "../logger";
import {Service, ServiceEvent} from "../services/service";
import {PageDataService} from "../services/homepage";
import {MongoDbRepository} from "../adapters/database";
import {config} from "../../config";

import * as dotenv from 'dotenv';
dotenv.config();

process.on('uncaughtException', function (err) {
  logger.error(err)
  console.log(err)
});

const createDbSession = async () => {
  // const repository = new MongoDbRepository(config.mongo.url);
  // await repository.connect(config.mongo.database)
  //
  // return repository;
}

const startMainService = () => {
  const service = new Service();
  service.run();

  return service;
}

const startWsServer = async (service: Service) => {
  const wss = new WebSocket.Server({ port: config.app.port });

  wss.on("listening", () => {
    logger.info(`WebSocket server listening on ${config.app.port}`)
  })

  wss.on('connection', function connection(ws) {
    ws.send(JSON.stringify(PageDataService.getHead()))
    ws.send(JSON.stringify(PageDataService.getGas()))
    ws.send(JSON.stringify(PageDataService.getActors()))
    ws.send(JSON.stringify(PageDataService.getEconomics()))
    ws.send(JSON.stringify(PageDataService.getMiners()))

    const listenerHead = () => { ws.send(JSON.stringify(PageDataService.getHead())) }
    const listenerGas = () => { ws.send(JSON.stringify(PageDataService.getGas())) }
    const listenerActors = () => { ws.send(JSON.stringify(PageDataService.getActors())) }
    const listenerEconomics = () => { ws.send(JSON.stringify(PageDataService.getEconomics())) }
    const listenerMiners = () => { ws.send(JSON.stringify(PageDataService.getMiners())) }

    service.on(ServiceEvent.NewHead, listenerHead)
    service.on(ServiceEvent.NewGas, listenerGas)
    service.on(ServiceEvent.NewActors, listenerActors)
    service.on(ServiceEvent.NewEconomics, listenerEconomics)
    service.on(ServiceEvent.NewMiners, listenerMiners)

    ws.onclose = () => {
      service.removeListener(ServiceEvent.NewHead, listenerHead)
      service.removeListener(ServiceEvent.NewGas, listenerGas)
      service.removeListener(ServiceEvent.NewActors, listenerActors)
      service.removeListener(ServiceEvent.NewEconomics, listenerEconomics)
      service.removeListener(ServiceEvent.NewMiners, listenerMiners)
    }
  });
}

export const run = async () => {
  // const repository = await createDbSession();
  const service = startMainService();

  startWsServer(service)
}

run();
