# DMARCation

Analysis of DMARC report emails

## Requirements

Node >=11.4

## Running

### With Docker

either

`./run.sh mailboxfilename`

or

`docker build -t dmarcation`
`docker run --name dmarcation -p8000:8000 --rm -v fullpathtomailboxfile:/code/mailboxfilename dmarcation mailboxfilename`

### Without Docker

`npm install`
`npm start -- mailboxfilename`
