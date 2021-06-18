import WebSocket from 'ws';
import {logger} from "../logger";
import {Service, ServiceEvent} from "../services/service";
import {getHomepage} from "../services/homepage";
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
    logger.info('new connection');
    const start = process.hrtime();
    const data = getHomepage();
    const start1 = process.hrtime(start);
    logger.info(`getHomepage: ${start1[0]}s ${start1[1] / 1000000}ms`)
    const stringifiedData = JSON.stringify(data);
    const start2 = process.hrtime(start);
    logger.info(`stringifiedData: ${start2[0]}s ${start2[1] / 1000000}ms`)
    // here we should make a specific services that retrieves data from db. Like a service for HTTP GET req
    ws.send(stringifiedData)
    // event approach is best, just send data along with the event. A HTTP service would return data, in WS emit it!
    const listener = () => { ws.send(JSON.stringify(getHomepage()))}
    service.on(ServiceEvent.DataReloaded, listener)
    ws.onclose = () => { service.removeListener(ServiceEvent.DataReloaded, listener) }
  });
}

export const run = async () => {
  // const repository = await createDbSession();
  const service = startMainService();

  startWsServer(service)
}

run();
