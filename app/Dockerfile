FROM node:10.16-alpine

COPY ./tc-fkb-message-api /workplace/tc-fkb-message-api
WORKDIR /workplace/tc-fkb-message-api
RUN npm install \ 
  npm audit fix

EXPOSE 3000 3001 3002 3003 3004 3005 3006 3007 3008

CMD npm run start