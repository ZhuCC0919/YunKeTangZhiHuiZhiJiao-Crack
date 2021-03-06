const request = require('../easy_request');
const fs = require('fs');
const path = require('path');
const extend = require('node.extend');
const logHandle = require('../log');



function Crack(user = 0, pwd = 0) {

  this.user = user;
  this.pwd = pwd;

  // 计数
  this.count = 0;

}

/**
 * 请求地址,放在原型中存储
 * @type {{getCellListByTopicId: string, getTopicListByModuleId: string, getModuleListByClassId: string, getCourseList: string, login: string}}
 */
Crack.prototype.requestUri = {

  login: 'https://zjy2.icve.com.cn/newmobileapi/mobilelogin/newlogin',
  getCourseList: 'https://zjy2.icve.com.cn/newmobileapi/student/getCourseList',
  getModuleListByClassId: 'https://zjy2.icve.com.cn/newmobileapi/AssistTeacher/getModuleListByClassId',
  getTopicListByModuleId: 'https://zjy2.icve.com.cn/newmobileapi/AssistTeacher/getTopicListByModuleId',
  getCellListByTopicId: 'https://zjy2.icve.com.cn/newmobileapi/AssistTeacher/getCellListByTopicId',
  getCellInfoByCellId: 'https://zjy2.icve.com.cn/newmobileapi/AssistTeacher/getCellInfoByCellId',
  stuProcessCellLog: 'https://zjy2.icve.com.cn/newmobileapi/Student/stuProcessCellLog',
  updateDataByCell: 'https://zjy2.icve.com.cn/newmobileapi/AssistTeacher/updateDataByCell',
};

Crack.prototype.go = function (body, option) {

  return new Promise((resolve, reject) => {

    let resultArray = [];

    let uri = this.requestUri;

    let nodeName = [
      'dataList',
      'moduleList',
      'topicList',
      'cellList',
      'cellChildNodeList',
      'cellInfo'
    ];

    let that = this;

    function handle(body, option) {

      // if (Object.prototype.toString.call(body) === '[object Array]') {
      //
      //     extend(body, body[0]);
      //
      // }

      let currentNode = '';

      let NodeHandle = {
        // 此函数调用了resolve
        dataList: function (body, option) {

          let arr = body.dataList;

          arr.forEach(item => {

            let optionNew = {};

            extend(optionNew, option);

            optionNew.courseOpenId = item.courseOpenId;

            optionNew.openClassId = item.openClassId;

            request.requestByPost(that.requestUri.getModuleListByClassId, optionNew)
              .then(body => {
                handle(body, optionNew);
              })
              .catch(logHandle);
          });

        },

        moduleList: function (body, option) {

          let arr = body.moduleList;

          arr.forEach(item => {

            let optionNew = {};

            extend(optionNew, option);

            optionNew.moduleId = item.moduleId;

            request.requestByPost(that.requestUri.getTopicListByModuleId, optionNew)
              .then(body => {
                handle(body, optionNew);
              })
              .catch(logHandle);

          });

        },

        topicList: function (body, option) {

          let arr = body.topicList;

          arr.forEach(item => {

            let optionNew = {};

            extend(optionNew, option);

            optionNew.topicId = item.topicId;

            request.requestByPost(that.requestUri.getCellListByTopicId, optionNew)
              .then(body => {
                if (body.cellList[0] === undefined) {
                  return false;
                }
                handle(body, optionNew);
              })
              .catch(logHandle);

          });

        },

        cellList: function (body, option) {

          let arr = body.cellList;

          arr.forEach(item => {

            let optionNew = {};

            extend(optionNew, option);

            if (item.cellType === 1) {

              optionNew.cellId = item.cellId;

              request.requestByPost(that.requestUri.getCellInfoByCellId, optionNew)
                .then(body => {
                  handle(body, optionNew);
                })
                .catch(logHandle);

            } else {

              handle(item, optionNew);

            }

          });


        },

        cellChildNodeList: function (body, option) {

          let arr = body.cellChildNodeList;

          arr.forEach(item => {

            let optionNew = {};

            extend(optionNew, option);

            optionNew.cellId = item.cellId;

            request.requestByPost(that.requestUri.getCellInfoByCellId, optionNew)
              .then(body => {
                handle(body, optionNew);
              })
              .catch(logHandle);

          });

        },

        cellInfo: function (body, option) {

          let arr = body.cellInfo;

          let optionNew = {};

          function getSecond(str = '00:03:07.7920000') {
            let time = str.slice(0, 8).split(':');
            let floatNum = '0.';
            if (str.length > 8) {
              floatNum += str.slice(9);
              floatNum = parseFloat(floatNum)
            } else {
              floatNum = 0;
            }
            return time[0] * 60 * 60 + time[1] * 60 + time[2] * 1 + floatNum;
          }

          extend(optionNew, option);

          optionNew.token = arr.token;

          optionNew.cellLogId = arr.cellLogId;

          optionNew.cellId = arr.cellId;

          if (arr.extension === 'video' || arr.extension === 'audio') {

            let json = JSON.parse(arr.resourceUrl);

            if (typeof json.urls.status === undefined) return this.sendRecord(optionNew);

            let url = json.urls.status;

            request.requestByGet(url)
              .then(res => {

                if (res && res.args && res.args.duration) {
                  let second = getSecond(res.args.duration);
                  optionNew.cellData = Buffer.from('zjy,' + second + ',0').toString('base64');
                  optionNew.timeLongEx = second < 240 ? 420 : second;
                }

                this.sendRecord(optionNew);

              })

          } else if (arr.extension === 'office') {

            let json = JSON.parse(arr.resourceUrl);

            if (typeof json.urls.status === undefined) return this.sendRecord(optionNew);

            let url = json.urls.status;

            request.requestByGet(url)
              .then(res => {
                if (res && res.args && res.args.page_count) {

                  optionNew.cellData = Buffer.from('zjy,0,' + res.args.page_count).toString('base64');

                }
                this.sendRecord(optionNew);
              })

          } else {
            this.sendRecord(optionNew);
          }

        },

        // 处理最终请求逻辑
        sendRecord: function (option) {

          let newOption = {
            sourceType: 2,
            picNum: 9999,
            studyCellTime: option.timeLongEx || 400,
            studyNewlyTime: option.timeLongEx || 400,
            studyNewlyPicNum: option.timeLongEx || 400,
            courseOpenId: option.courseOpenId,
            openClassId: option.openClassId,
            cellId: option.cellId,
            cellLogId: option.cellLogId,
            token: option.token
          };

          request.requestByPost(that.requestUri.stuProcessCellLog, newOption)
            .then(body => {
              if (body.code !== 1) {
                return logHandle(new Error('发送结果时code不为1了，错了啊。' + JSON.stringify(body)));
              }
              that.count++;

              if (!option.cellData) return false;

              return request.requestByPost(that.requestUri.updateDataByCell, {
                cellId: newOption.cellId,
                cellData: option.cellData,
                sourceType: 2
              });
            })
            .catch(logHandle);

        }

      };

      nodeName.forEach(item => {

        if (body[item]) {
          currentNode = item;
        }

      });

      switch (currentNode) {
        case 'dataList':
          NodeHandle.dataList(body, option);
          break;
        case 'moduleList':
          NodeHandle.moduleList(body, option);
          break;
        case 'topicList':
          NodeHandle.topicList(body, option);
          break;
        case 'cellList':
          NodeHandle.cellList(body, option);
          break;
        case 'cellChildNodeList':
          NodeHandle.cellChildNodeList(body, option);
          break;
        case 'cellInfo':
          NodeHandle.cellInfo(body, option);
          break;
      }


    }

    handle(body, option);

  });

};

/**
 * @features 登录云课堂 返回stuId
 *
 * @parameter then(body) catch(err)
 *
 * @returns {Promise}
 *
 * @info { code: 1,
 * userType: 1,
 * token: 'popqweiopkwnlkasddf',
 * userName: '1833333',
 * secondUserName: '',
 * userId: 'popqweiopkwnlkasddf',
 * displayName: '格式',
 * url: 'http://zjy2.icve.com.cn/common/images/default_avatar.jpg',
 * schoolName: '2222222',
 * schoolId: 'popqweiopkwnlkasddf',
 * isValid: 1,
 * isNeedMergeUserName: 0,
 * pwd: '2222' }
 *
 */



if (!process.argv[2] || !process.argv[3]) {
  return console.log('参数错误！');
} else {
  let crack = new Crack();
  crack.go(JSON.parse(process.argv[2]), JSON.parse(process.argv[3]));
  process.on('exit', () => console.log(crack.count));
}


// let crack = new Crack();
// crack.go(JSON.parse(`
// {"code":1,"moduleList":[{"moduleId":"1u3mabcqejfge8xhqqfbxa","isFirstModule":1,"moduleName":"情境一：建筑生活给排水工程计价","sortOrder":0},{"moduleId":"1u3mabcqk7hib02me6ldja","isFirstModule":0,"moduleName":"情境二：建筑电气照明工程计价","sortOrder":1},{"moduleId":"1u3mabcqvy1faeban74ivw","isFirstModule":0,"moduleName":"情境三：建筑防雷接地工程计价","sortOrder":2},{"moduleId":"1u3mabcqhzdmq5sxap9tsq","isFirstModule":0,"moduleName":"情境四：建筑消火栓系统工程计价","sortOrder":3},{"moduleId":"1u3mabcqgbvgef0edeoprw","isFirstModule":0,"moduleName":"情境五：建筑智能化工程计价","sortOrder":4}],"msg":"获取成功！"} 


// `), JSON.parse(`
// {"stuId":"bbqtabiohbljxrcivdexhg","courseOpenId":"uobgabcqhrxfjno08yelzq","openClassId":"cbhjabcqn6hnysxchwxlrg"}
// `));
// process.on('exit', () => console.log(crack.count)); 
