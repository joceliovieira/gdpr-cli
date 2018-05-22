'use strict';

const got = require('got');
const chalk = require('chalk');
const sslCert = require('get-ssl-certificate');
const HTMLParser = require('./html-parser');
const CSSParser = require('./css-parser');
//const tools = require('./tools');
const UI = require('./ui');

class Tasks {
  constructor(url, uiInstance) {
    this.default_tasks = {
      normalize: {
        dependencies: [],
        mandatory: true
      },
      html: {
        dependencies: []
      },
      css: {
        dependencies: ['html']
      },
      js: {
        dependencies: ['html']
      },
      ssl: {
        dependencies: ['html', 'css']
      },
      fonts: {
        dependencies: ['html', 'css']
      },
      prefetching: {
        dependencies: ['html']
      }
    };

    // Classes implementation
    this.ui = (!uiInstance) ? new UI() : uiInstance;
    this.hp, this.cp;

    this.url = url;
    this.tasks = [];
    this.data = {};

    // Put mandatory tasks already in the task list
    this.tasks = this.tasks.concat(this.getMandatoryTasks());
  }


  /**
   * Adds a new Task to the list
   * @param {string} task
   * @class Tasks
   */
  new(task) {
    console.log(task);
    this.default_tasks[task].dependencies.forEach(dep => {
      if (this.tasks.indexOf(dep) === -1) this.tasks.push(dep);
    });
    if (this.tasks.indexOf(task) === -1) this.tasks.push(task);
  }


  /**
   * Revoves a Task from the list
   * @param {string} task 
   * @class Tasks
   */
  remove(task) {
    if (this.tasks.indexOf(task) !== -1) {
      this.tasks.splice(this.tasks.indexOf(task), 1);
    }
    //console.log(this.tasks);
  }


  /**
   * Checks if the task list has a specifig task
   * @param {string} task 
   * @class Tasks
   */
  hasTask(task) {
    return this.tasks.indexOf(task) !== -1;
  }


  /**
   * Gets all Tasks, which are mandatory - even with Task Selectors
   * @class Tasks
   */
  getMandatoryTasks() {
    let t = [];
    for (const task in this.default_tasks) {
      if (this.default_tasks[task].mandatory) t.push(task);
    }
    return t;
  }


  /**
   * Prepare Task Runner Array
   * @class Tasks
   */
  prepareTasks() {
    // if no tasks specified do them all
    if (this.tasks.length === this.getMandatoryTasks().length) {
      for (const t in this.default_tasks) {
        if (!this.default_tasks[t].mandatory) this.tasks.push(t)
      }
    }
    this.tasks.forEach(t => {
      this.data[t] = {};
    });
  }


  /**
   * Runs the Task Manager
   * @class Tasks
   */
  run() {

    const self = this;

    this.prepareTasks();
    console.log('Tasks: ', this.tasks);

    if (this.tasks.indexOf('html') !== -1) {

      this.normalizeURL()
        .then(() => this.processHTML())
        .then(() => this.processCSS())
        .then(() => this.processJS())
        .then(() => this.processSSL())
        .then(() => {
          console.log('Remaining: ', this.tasks);

          this.getGeneralInformation();
          this.getSSLInformation();
          this.getFontInformation();

          console.log('\n\n');
          console.log('Remaining: ', this.tasks);
          //console.log(this.data);
        }).catch(e => console.log(e.message));
    }
  }


  // INFO: Content Creation 

  getPrefetchingInformation() {

  }

  getFontInformation() {
    if (this.hasTask('fonts')) {

      this.cp = new CSSParser(this.data.css);
      //let fonts = this.cp.checkFonts();
      //console.log(fonts);

      this.ui.headline('Fonts Implementation');
      this.remove('fonts');
    }
  }

  /**
   * Gathers SSL Information
   * @class Tasks
   */
  getSSLInformation() {

    if (this.hasTask('ssl')) {
      if (Object.keys(this.data.ssl).length === 0 && this.data.ssl.constructor === Object) {
        this.ui.headline('SSL Certificate');
        this.ui.error('There is no SSL/TLS available.', false);
        this.remove('ssl');
        return;
      } else {
        this.ui.headline('SSL Certificate');

        this.ui.listitem('Common Name', this.data.ssl.common_name);
        this.ui.listitem('Country', this.data.ssl.country);
        this.ui.listitem('Organization', this.data.ssl.organization);
        this.ui.listitem('Organization CN', this.data.ssl.org_cn + '\n');

        this.ui.listitem('Valid from', this.data.ssl.valid_from);
        this.ui.listitem('Valid to', this.data.ssl.valid_to);
        this.ui.listitem('Serial Number', this.data.ssl.serial_nr);
        this.ui.listitem('FP SHA-1', this.data.ssl.fingerprint);
        this.ui.listitem('FP SHA-256', this.data.ssl.fingerprint256);

        this.remove('ssl');
      }

    }
  }


  /**
   * Gathes General Information (meta data) of the Website
   * @class Tasks
   */
  getGeneralInformation() {

    this.ui.headline('General Information');

    this.ui.listitem('Title', this.hp.getTitle());
    this.ui.listitem('Description', this.hp.getDescription());
    this.ui.listitem('URL', this.data.html.url.href);

    let gen = this.hp.getGenerator(this.data.css);
    gen = (gen === '') ? 'Unknown' : gen;
    this.ui.listitem('Software', gen);
    if (gen.toLowerCase().indexOf('wordpress') !== -1) {
      let theme = '';
      this.data.css.forEach(css => {
        let match = css.url.match(/themes\/(.*?)\/style\.css/);
        if (match !== null) {
          theme = match[1];
          theme = theme.charAt(0).toUpperCase() + theme.slice(1); // Capitalize
        };
      });
      this.ui.listitem('Theme', (theme !== '') ? theme : 'Unknown');
    }
  }

  /**
   * Finds CSS and JS references in the HTML file
   * @class Tasks
   */
  setupAdditionalContent() {
    if (this.hasTask('html')) {

      this.ui.message({
        normal: 'Setup additional content',
        verbose: 'Setup additional content'
      });
      if (this.tasks.indexOf('css') != -1) {
        this.ui.message({
            verbose: chalk.dim('-> CSS files')
          }, '',
          false);
        this.data.css = this.hp.getStylesheetURLs(this.data.html.url.href);
      }
      if (this.tasks.indexOf('js') != -1) {
        this.ui.message({
            verbose: chalk.dim('-> JavaScript files')
          },
          '', false);
        this.data.js = this.hp.getJavascriptURLs(this.data.html.url.href);
      }
      //this.ui.message('ADDITIONAL CONTENT FINISHED');
      this.remove('html');
      return Promise.resolve(this.urls);
    } else return Promise.resolve(100); // Status 100 CONTINUE
  }


  // INFO: PROCESSING 


  /**
   * Gets the SSL Certificate
   * @class Tasks
   */
  processSSL() {
    if (this.hasTask('ssl')) {
      this.ui.message({
        normal: 'Loading SSL Certificate',
        verbose: 'Loading SSL Certificate'
      });
      return new Promise((resolve, reject) => {
        if (this.data.html.url.protocol !== 'https:') {
          this.ui.error("Can't establish SSL/TLS connection!");
          resolve();
        } else {
          sslCert.get(this.data.html.url.hostname).then(cert => {

            this.data.ssl.common_name = cert.subject.CN;
            this.data.ssl.country = cert.issuer.C;
            this.data.ssl.organization = cert.issuer.O;
            this.data.ssl.org_cn = cert.issuer.CN;
            this.data.ssl.valid_from = cert.valid_from;
            this.data.ssl.valid_to = cert.valid_to;
            this.data.ssl.serial_nr = cert.serialNumber;
            this.data.ssl.fingerprint = cert.fingerprint;
            this.data.ssl.fingerprint256 = cert.fingerprint256;

            //this.ui.message('SSL FINISHED');
            resolve(cert);
          }).catch(e => reject(e));
        }
      });
    } else return Promise.resolve(100); // Status 100 CONTINUE
  }


  /**
   * Gets any external JS content
   * @class Tasks
   */
  processJS() {

    if (this.hasTask('js')) {

      this.ui.message({
        normal: 'Loading JS files',
        verbose: 'Loading JS files'
      });
      return this.processMultipleItems(this.data.js, this.loadExternalItem).then(res => {

        this.data.js = res;
        this.ui.message({
          verbose: chalk.dim('-> Looking for Inline JavaScript')
        }, {
          code: 200,
          msg: 'OK'
        }, false);
        this.hp.getInlineJS();
        this.data.js.inline = this.hp.getInlineJS();
        //this.ui.message('JS FINISHED');
        this.remove('js');
        return res;
      });
    } else return Promise.resolve(100); // Status 100 CONTINUE
  }


  /**
   * Gets any external CSS content
   * @class Tasks
   */
  processCSS() {
    if (this.hasTask('css')) {
      this.ui.message({
        normal: 'Loading CSS files',
        verbose: 'Loading CSS files'
      });
      return this.processMultipleItems(this.data.css, this.loadExternalItem).then(res => {

        this.data.css = res;
        this.ui.message({
          verbose: chalk.dim('-> Looking for Inline CSS')
        }, {
          code: 200,
          msg: 'OK'
        }, false);
        this.data.css.inline = this.hp.getInlineCSS();
        //this.ui.message('CSS FINISHED');
        this.remove('css');
        return res;
      });
    } else return Promise.resolve(100); // Status 100 CONTINUE
  }


  /**
   * Gets the main HTML file
   * @class Tasks
   */
  processHTML() {
    if (this.hasTask('html')) {

      this.ui.message({
        normal: 'Loading HTML file',
        verbose: 'Loading ' + chalk.yellow(this.data.html.url.href)
      });
      return this.loadExternalItem(this.data.html).then(res => {
        this.data.html = res;
        this.hp = new HTMLParser(this.data.html.content);
        //this.ui.message('HTML FINISHED');

        return this.setupAdditionalContent();
      });
    } else return Promise.resolve(100); // Status 100 CONTINUE
  }


  // INFO: HELPERS 


  /**
   * Iterator function to synchronize Promises
   * @param {Array} array 
   * @param {Function} fn 
   */
  processMultipleItems(array, fn) {
    const self = this;
    var results = [];
    return array.reduce((p, item) => {
      return p.then(() => {
        return fn(item).then((data) => {
          self.ui.message({
            verbose: chalk.dim('-> ' + item.url)
          }, {
            code: data.statusCode,
            msg: data.statusMessage
          }, false);
          results.push(data);
          return results;
        });
      });
    }, Promise.resolve());
  }


  /**
   * Loads an external (CSS or JS) file
   * @param {URL} item 
   */
  loadExternalItem(item) {
    return new Promise(resolve => {
      const Obj = {};
      Obj.url = item.url;
      got(item.url).then(res => {
        Obj.headers = res.headers;
        Obj.content = res.body;
        Obj.statusCode = res.statusCode;
        Obj.statusMessage = res.statusMessage;
        resolve(Obj);
      }, reason => {
        Obj.statusCode = reason.statusCode;
        Obj.statusMessage = reason.statusMessage;
        resolve(Obj);
      });
    });
  }


  /**
   * Checks if the URL is valid and upgrades the protocol if needed
   * @class Tasks
   */
  normalizeURL() {
    let url = this.url;

    this.ui.message({
      normal: 'Checking the URL ...',
      verbose: 'Checking the URL ' + chalk.yellow(url)
    });

    url = url.replace(/(https?:)?\/\//, ''); // delete the protocol
    url = (url.startsWith('/')) ? url.substr(1) : url; // get rid of trailing slash
    url = (url.endsWith('/')) ? url : url + '/'; // ensure that it ends with a slash
    url = 'http://' + url; // set unsecure protocol
    // upgrade protocol if needed
    return got(url).then(res => {
      url = (url != res.url) ? res.url : url;
      this.data.html = {
        url: new URL(url)
      };
      if (this.url !== this.data.html.url.href) {
        this.ui.message({
          verbose: 'URL ' + chalk.yellow(this.url) + ' was adjusted to ' + chalk.yellow(this.data.html.url.href) + '.'
        });
      }
      this.remove('normalize');
      Promise.resolve(this.data.html);
    });
  }

}

module.exports = Tasks;