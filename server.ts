
import * as express from 'express';
import * as http from 'http';
import * as socketio from 'socket.io';
import * as serveStatic from 'serve-static';
import * as path from 'path';
import * as util from 'util';
import { Temp } from './temp';


const app = express();
const httpServer = http.createServer(app);
const io = socketio(httpServer, {
    pingTimeout: 10000
});


app.use(serveStatic(path.resolve(__dirname, 'public')));



httpServer.listen(3000, () => {
    console.log(`Server ready`);
});

var temp = new Temp();


io.on('connection', (socket) => {
    console.log('got connection');
    socket.on('test-send-1', (data) => {
        console.log(data);
    });
    socket.emit('init-connection', temp.map);
});



setInterval(() => {
    io.sockets.emit('test-msg-1', 'foo');
}, 3000);