# Overlord RTC Web App

a demo of next generation real-time communication channels. Goal is to illustrate the power of the modern web browser in conjunction with low-latency media streams.

Contact me if you have further questions. Matt, February 2015



## installation


### dependency libraries



1. Make sure `git`, `ant`, `npm`, `NodeJS`, `bower` all are installed globally
 
 
```javascript
>npm --version
v0.12.0
```
 
 
```
>npm --version
2.5.1
```
 
```
>bower --version
1.3.12
```

2. need WebRTC toolkit. git will clone it inside `lib` directory

```
ant init
```

3. Download NPM related components
```
npm install
```
 
 
### execution

```
npm start
```

Then host on an <b>https</b> server. use only secure WebRTC to collaborate with all of the other secure services.

Point browser locally to port <b>8765</b> as defined by `package.json`

