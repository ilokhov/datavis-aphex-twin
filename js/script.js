var margin = {top: 20, right: 20, bottom: 20, left: 30},
    width = 1040 - margin.left - margin.right,
    height = 520 - margin.top - margin.bottom;

var chart = d3.select("#chart")
              .append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
              .append("g")
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

var transitionSpeed = 400,
    delay = 10;



// load both datasets
var q = d3.queue();

d3.queue()
  .defer(d3.csv, "tracks.csv")
  .defer(d3.json, "albums.json")
  .await(function(error, tracks, albums) {
    if (error) {
      throw error;
    }
    else {
      main(tracks, albums);
    }
  });

function main(tracks, albums) {

  // preload images
  Object.keys(albums).forEach(function(key) {
    (new Image()).src = "../img/" + key + ".jpg";
  });



  var totalLength = 0;

  // coerce types
  tracks.forEach(function(bin) {
    bin.bpm = +bin.bpm;
    bin.length = +bin.length;

    // calculate total length of all tracks
    totalLength += bin.length;
  });



  // album specific opacity based on db and bpm
  function getAlbumTracks(album) {
    return tracks.filter(function(d) {
      return d.album === album;
    });
  }

  function getMaxAlbumDb(albumTracks) {
    return d3.min(albumTracks.map(function(d) {return Math.abs(d.db);}));
  }

  function getMaxAlbumBpm(albumTracks) {
    return d3.max(albumTracks.map(function(d) {return d.bpm;}));
  }

  var maxDbs = {};
  var maxBpms = {};
  for (var album in albums) {
    if (albums.hasOwnProperty(album)) {
      var albumTracks = getAlbumTracks(album);
      var maxDb = getMaxAlbumDb(albumTracks);
      maxDbs[album] = maxDb;
      var maxBpm = getMaxAlbumBpm(albumTracks);
      maxBpms[album] = maxBpm;
    }
  }

  function getOpacityDb(db, album) {
    return (maxDbs[album] / Math.abs(db)).toFixed(2);
  }

  function getOpacityBpm(bpm, album) {
    if (bpm === 0) {
      return 0;
    }
    else {
      return (bpm / maxBpms[album]).toFixed(2);
    }
  }



  // scales
  var xScale = d3.scaleLinear()
                  .domain([0, totalLength])
                  .range([0, width]);

  var yScaleDb = d3.scaleLinear()
                  .domain([d3.min(tracks.map(function(d) {return Math.abs(d.db);})), d3.max(tracks.map(function(d) {return Math.abs(d.db);})) + 5])
                  .range([0, height]);

  var yScaleBpm = d3.scaleLinear()
                  .domain([d3.max(tracks.map(function(d) {return d.bpm;})), 0])
                  .range([0, height]);



  // axis
  var yAxisDb = d3.axisLeft(yScaleDb).ticks(4).tickFormat(function(d) { return "-" + d; });
  chart.append("g")
        .attr("class", "axis axis-db")
        .attr("transform", "translate(-5,0)")
        .call(yAxisDb)
       .append("text")
        .attr("class", "label")
        .attr("y", -10)
        .attr("x", 5)
        .text("dB");

  var yAxisBpm = d3.axisLeft(yScaleBpm).ticks(2);
  chart.append("g")
        .attr("class", "axis axis-bpm hidden")
        .attr("transform", "translate(-5,0)")
        .call(yAxisBpm)
       .append("text")
        .attr("class", "label")
        .attr("y", -10)
        .attr("x", 5)
        .text("BPM");



  // calculate current bin position and track global position
  var globalPos = 0;
  function binPosition(thisLength) {
    var thisPos = globalPos;
    globalPos += thisLength;
    return thisPos;
  }

  // bins
  chart.selectAll(".bin")
    .data(tracks)
  .enter().append("rect")
    .attr("class", function(d) {
      return "bin " + d.album;
    })
    .attr("opacity", function(d) {
      return getOpacityDb(d.db, d.album);
    })
    .attr("x", function(d) {
    return binPosition(xScale(d.length));
    })
    .attr("width", function(d) {
      return xScale(d.length);
    })
    .attr("height", function(d) {
      return 0;
    })
    .attr("y", function(d) {
      return height;
    })
    .on("mouseover", function(d) {
      shiftBin(d3.select(this), d, this);
    })
    .transition()
    .delay(function(d, i) {
      return i * delay;
    })
    .duration(transitionSpeed)
    .ease(d3.easeCubic)
    .attr("height", function(d) {
      return height - yScaleDb(Math.abs(d.db));
    })
    .attr("y", function(d) {
      return yScaleDb(Math.abs(d.db));
    });



  // set track info
  var albumCover = document.getElementById("album-cover"),
      albumTitle = document.getElementById("album-title"),
      albumYear = document.getElementById("album-year");

  var trackTitle = document.getElementById("track-title"),
      trackLength = document.getElementById("track-length"),
      trackDb = document.getElementById("track-db"),
      trackBpm = document.getElementById("track-bpm");

  // convert time
  function secToMinSec(d) {
    d = Number(d);
    var m = Math.floor(d % 3600 / 60);
    var s = Math.floor(d % 3600 % 60);
    return (m + ":" + (s < 10 ? "0" : "") + s);
  }

  function setTrackInfo(bin, d, thisSel) {
    // hover effect
    chart.selectAll(".bin").classed("active", false);
    bin.classed("active", true);

    // set album info
    albumCover.className = d.album;
    albumTitle.textContent = albums[d.album].title;
    albumYear.textContent = albums[d.album].year;

    // set track info
    trackTitle.textContent = d.title;
    trackLength.textContent = secToMinSec(d.length);
    trackDb.textContent = d.db + " dB";
    trackBpm.textContent = d.bpm === 0 ? "n/a" : d.bpm + " BPM";
  }



  // set first bin on load
  var firstBin = d3.select(".bin");
  firstBin.classed("active", true);
  firstBin.each(function(d) {
    setTrackInfo(firstBin, d, this);
  });

  // hover point
  function getPointCx(thisBin) {
    return +thisBin.attr("x") + (+thisBin.attr("width") / 2);
  }

  var pointR = 5,
      pointCx = getPointCx(d3.select(".bin")),
      pointCy = height + 10;

  var point = chart.append("circle")
                  .attr("r", pointR)
                  .attr("cx", pointCx)
                  .attr("cy", pointCy)
                  .attr("fill", "rgb(42,42,42)");



  // update
  d3.selectAll(".button-update").on("click", function() {
    d3.selectAll(".button-update").classed("button-update-active", false);
    d3.select(this).classed("button-update-active", true);

    // determine if we are updating dB or BPM using the id
    update(this.id);
  });

  function update(type) {
    if (type === "db") {
      d3.select(".axis-bpm").classed("hidden", true);
      d3.select(".axis-db").classed("hidden", false);
    }
    else {
      d3.select(".axis-db").classed("hidden", true);
      d3.select(".axis-bpm").classed("hidden", false);
    }

    chart.selectAll(".bin")
      .data(tracks)
      .transition()
      .delay(function(d, i) {
        return i * delay;
      })
      .duration(transitionSpeed)
      .ease(d3.easeCubic)
      .attr("height", function(d) {
        if (type === "db") {
          return height - yScaleDb(Math.abs(d.db));
        }
        else {
          return height - yScaleBpm(d.bpm);
        }
      })
      .attr("y", function(d) {
        if (type === "db") {
          return yScaleDb(Math.abs(d.db));
        }
        else {
          return yScaleBpm(d.bpm);
        }
      })
      .attr("opacity", function(d) {
        if (type === "db") {
          return getOpacityDb(d.db, d.album);
        }
        else {
          return getOpacityBpm(d.bpm, d.album);
        }
      });
  }



  // shift
  function shiftBin(thisSel, d, thisBin) {
    setTrackInfo(thisSel, d, thisBin);
    point.transition()
         .duration(150)
         .ease(d3.easeQuad)
         .attr("cx", getPointCx(thisSel));
  }

  // shift buttons
  d3.selectAll(".button-shift").on("click", function() {
    var activeBin = d3.select(".active"),
        direction = this.id,
        newBin;

    activeBin.each(function(d) {
      if (direction === "left") {
        // if first bin, shift to last bin
        if (this.previousSibling == null || !this.previousSibling.classList.contains("bin")) {
          newBin = d3.select(this.parentNode.getElementsByClassName("bin")[this.parentNode.getElementsByClassName("bin").length - 1]);
        }
        else {
          newBin = d3.select(this.previousSibling);
        }
      }
      else {
        // if last bin, shift to first bin
        if (this.nextSibling == null || !this.nextSibling.classList.contains("bin")) {
          newBin = d3.select(this.parentNode.getElementsByClassName("bin")[0]);
        }
        else {
          newBin = d3.select(this.nextSibling);
        }
      }

      newBin.each(function(d) {
        shiftBin(d3.select(this), d, this);
      });
    });
  });

}