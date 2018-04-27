
var csvParser = this.CSV;
csvParser.RELAXED = true;



var client = ZAFClient.init();
client.invoke('resize', { width: '104%', height: '400px' });

function init() {
  bindClickHandlers();
}


var globalVars = {
  parsedCSV: null,
  subject: null,
  description: null,
  requesterEmail: null,
  requesterName: null,
  productArea: null,
  requesterID: null,
  errorTicketCreate: null,
  counter: null,
  promises: null,
};

var events = {
  'change #selDepartment': 'changeTemplate',
  'click #createTickets': 'getCSVFile',
};

function bindClickHandlers() {
  $('#createTickets').click(function() {
    getCSVFile();
  });
}

var requests = {

  getCSV: function(filename) {
    return {
      url: 'https://docs.google.com/spreadsheets/d/' + filename + '/gviz/tq?tqx=out:csv',
      type: 'GET',
      cors: false,
      dataType: 'text',
    };
  },
  searchRequester: function(email) {
    return {
      url: '/api/v2/search?query=type%3Auser%20email%3A' + encodeURI(email),
      type: 'GET'
    };
  },
  createRequester: function(name, email) {
    return {
      url: '/api/v2/users.json',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        'user': {
          'name': name,
          'email': email
        }
      })
    };
  },
  importTicket: function(subject, description, email, name) {
    return {
      url: '/api/v2/tickets.json',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        "ticket": {
          "requester": {"email": email, "name": name},
          "tags": ["zendesk_training_tickets"],
          "subject": subject,
          "comment": {
            "body": description
          }
        }
      })
    };
  }
};

init();

function getCSVFile() {
  this.$('#createTickets').prop('disabled', true);
  this.counter = 0;
  this.$('div.progress > div.progress-bar').css({ "width": "0%" });
  this.requesterName = this.$("#inputName").val(); //setting requester name from input field
  this.requesterEmail = this.$("#inputEmail").val(); //setting requester email from input field
  this.productArea = this.$("#selProductArea option:selected").val(); //setting product area from dropdown
  if (this.productArea === undefined) this.productArea = this.$("#selDepartment option:selected").val();

  var CSVrequest = requests.getCSV(this.productArea);
  client.request(CSVrequest).then(function(data, error) {
    if (error) {
      console.log("ERROR");
      errorGettingCSV();
    } else {
      console.log("CSV RESPONSE", data);
      parseCSV(data);
    }
  });

}
function parseCSV(data) {
  this.parsedCSV = csvParser.parse(data); //parse CSV file and set parsedCSV var
  var searchRequest = requests.searchRequester();

  client.request(searchRequest).then(function(data, err) {
    console.log('REQUESTER DATA', data);
    makeTickets();
  });
}

function errorGettingCSV() {
  services.notify("Unable to retrieve file!", 'error');
}

function makeRequester(data) {
  if (data.count !== 0) { // if there was a result from the search
    this.requesterID = data.results[0].id; // set requesterID to by grabbing userID from search result
    makeTickets(); // call on function to create tickets
  } else { // if the requester doesn't exist already, create the requester as a new user to avoid 409 errors using the ticket import API
  var createRequester = requests.createRequester();
  client.request(createRequester).then(function(data, err) {
    if (err) {
      client.invoke('notify', 'Error creating user');
    } else {
      this.requesterID = data.user.id;
      makeTickets();
    }
  });
}
}

function makeTickets() {
  this.promises = [];
  var num = null;
  var that = this; // aliasing this to another var to use inside _.each function
  _.each(this.parsedCSV, function(each, i, l) { //iterate over parsedCSV
    that.num = l.length;
      that.subject = each[0]; //setting subject
      that.description = each[1]; //setting description
    that.email = each[2]; //setting requester email
    var firstname = that.email.split('@')[0].split('.')[0];
    firstname = firstname.charAt(0).toUpperCase() + firstname.slice(1);
    var lastname = that.email.split('@')[0].split('.')[1];
    lastname = lastname.charAt(0).toUpperCase() + lastname.slice(1);
    that.name = firstname + ' ' + lastname;
    var importTicket = requests.importTicket(that.subject, that.description, that.email, that.name);
    var request = client.request(importTicket).then(function(data, err){
      if (err) {
        console.log('importTicket ERROR', err);
        return;
      } else {
        that.counter +=1;
        var percentComplete = (that.counter / that.num) * 100;
        console.log('Created a Ticket'); // console logging upon success for debugging
        that.$('div.progress > div.progress-bar').css({ "width": percentComplete + "%" });
      }
    });
    that.promises.push(request);
  }); 
  /* jshint ignore:start */
  Promise.all(this.promises).then(function (argument){
    client.invoke('notify', 'Successfully Created Tickets! :)')

    this.$('#createTickets').prop('disabled', false);
  },function(argument) {
    client.invoke('warning', 'Error creating tickets')
    this.$('#createTickets').prop('disabled', false);
  });
  /* jshint ignore:end */
}

